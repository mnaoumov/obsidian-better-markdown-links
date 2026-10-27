import type { AbortSignalComponent } from '@mnaoumov/obsidian-lib/components/abort-signal-component';
import type { ConsoleDebugComponent } from '@mnaoumov/obsidian-lib/components/console-debug-component';
import type {
  ConvertLinkParams,
  GenerateMarkdownLinkParams
} from '@mnaoumov/obsidian-lib/link';
import type { CachedMetadataEx } from '@mnaoumov/obsidian-lib/metadata-cache';
import type { App } from 'obsidian';

import { GenerateMarkdownLinkDefaultParamsComponent } from '@mnaoumov/obsidian-lib/components/generate-markdown-link-default-params-component';
import { LayoutReadyComponent } from '@mnaoumov/obsidian-lib/components/layout-ready-component';
import { convertLink } from '@mnaoumov/obsidian-lib/link';
import {
  getLinks,
  parseMetadata
} from '@mnaoumov/obsidian-lib/metadata-cache';
import { abortSignalAny } from '@mnaoumov/typescript-lib/abort-controller';
import { convertAsyncToSync } from '@mnaoumov/typescript-lib/async';
import { SilentError } from '@mnaoumov/typescript-lib/error';
import {
  normalizeOptionalProperties,
  removeUndefinedProperties
} from '@mnaoumov/typescript-lib/object-utils';
import {
  TAbstractFile,
  TFile
} from 'obsidian';

import type { LinkConverter } from '../conversion/link-converter.ts';
import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { getLinkStyleForReference } from '../conversion/frontmatter-wikilink-style.ts';
import { GenerateMarkdownLinkPatchComponent } from '../link-generation/generate-markdown-link-extended-impl.ts';
import { EditorSaveFileCommandPatchComponent } from './patches/editor-save-file-command-patch-component.ts';
import { TextFileViewSavePatchComponent } from './patches/text-file-view-save-patch-component.ts';
import { WorkspaceOpenLinkTextPatchComponent } from './patches/workspace-open-link-text-patch-component.ts';

interface BetterMarkdownLinksComponentConstructorParams {
  readonly abortSignalComponent: AbortSignalComponent;
  readonly app: App;
  readonly consoleDebugComponent: ConsoleDebugComponent;
  readonly linkConverter: LinkConverter;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class BetterMarkdownLinksComponent extends LayoutReadyComponent {
  private readonly abortSignalComponent: AbortSignalComponent;
  private readonly consoleDebugComponent: ConsoleDebugComponent;
  private readonly linkConverter: LinkConverter;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly processFileAbortControllers = new Map<string, AbortController>();
  private readonly saveCommandFilePaths = new Set<string>();

  public constructor(params: BetterMarkdownLinksComponentConstructorParams) {
    super(params.app);

    this.abortSignalComponent = params.abortSignalComponent;
    this.consoleDebugComponent = params.consoleDebugComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.linkConverter = params.linkConverter;
  }

  public async handleNavigation(file: TFile): Promise<void> {
    this.abortSignalComponent.abortSignal.throwIfAborted();

    if (!this.pluginSettingsComponent.settings.shouldConvertLinksOnNavigation()) {
      return;
    }

    await this.processFile(file);
  }

  public async handleSave(file: TFile): Promise<void> {
    this.abortSignalComponent.abortSignal.throwIfAborted();

    const isSaveCommand = this.saveCommandFilePaths.delete(file.path);
    if (!this.pluginSettingsComponent.settings.shouldConvertLinksOnSave(isSaveCommand)) {
      return;
    }

    await this.processFile(file);
  }

  public markSaveCommand(path: string): void {
    this.saveCommandFilePaths.add(path);
  }

  protected override onLayoutReady(): void {
    this.addChild(
      new GenerateMarkdownLinkPatchComponent({
        app: this.app,
        fileManager: this.app.fileManager
      })
    );
    this.addChild(
      new GenerateMarkdownLinkDefaultParamsComponent({
        getDefaultParams: (): Partial<GenerateMarkdownLinkParams> => {
          const settings = this.pluginSettingsComponent.settings;
          // `removeUndefinedProperties`, because outside the forced modes `linkStyle` and `linkPathStyle`
          // are `undefined` and these params are merged with `Object.assign`: leaving a key in place would
          // clobber a style another plugin's default-params function had set, instead of standing aside
          // for it.
          return removeUndefinedProperties(normalizeOptionalProperties<Partial<GenerateMarkdownLinkParams>>({
            isEmptyEmbedAliasAllowed: settings.shouldAllowEmptyEmbedAlias,
            linkPathStyle: settings.getGeneratedLinkPathStyle(),
            linkStyle: settings.getGeneratedLinkStyle(),
            shouldIncludeAttachmentExtensionToEmbedAlias: settings.shouldIncludeAttachmentExtensionToEmbedAlias,
            shouldUseAngleBrackets: settings.shouldUseAngleBrackets,
            shouldUseLeadingDotForRelativePaths: settings.shouldUseLeadingDotForRelativePaths,
            shouldUseLeadingSlashForAbsolutePaths: settings.shouldUseLeadingSlashForAbsolutePaths
          }));
        }
      })
    );

    this.registerEvent(this.app.vault.on('modify', convertAsyncToSync(this.handleModify.bind(this))));

    this.addChild(
      new WorkspaceOpenLinkTextPatchComponent({
        app: this.app,
        betterMarkdownLinksComponent: this
      })
    );

    this.addChild(
      new TextFileViewSavePatchComponent({
        betterMarkdownLinksComponent: this
      })
    );

    this.addChild(
      new EditorSaveFileCommandPatchComponent({
        app: this.app,
        betterMarkdownLinksComponent: this
      })
    );
  }

  private async handleModify(file: TAbstractFile): Promise<void> {
    this.abortSignalComponent.abortSignal.throwIfAborted();

    if (!(file instanceof TFile) || !this.pluginSettingsComponent.settings.shouldConvertLinksOnModify()) {
      return;
    }

    await this.processFile(file);
  }

  private hasFileUrlLink(cache: CachedMetadataEx): boolean {
    const externalLinks = [
      ...cache.externalLinks ?? [],
      ...cache.frontmatterExternalLinks ?? [],
      ...cache.multiValueFrontmatterExternalLinks ?? []
    ];
    return externalLinks.some((externalLink) => externalLink.parseLinkResult.isFileUrl);
  }

  private async processFile(file: TFile): Promise<void> {
    let processFileAbortController = this.processFileAbortControllers.get(file.path);
    processFileAbortController?.abort(new SilentError(`File ${file.path} is already being processed`));
    this.processFileAbortControllers.delete(file.path);

    const suggestionContainer = activeDocument.querySelector<HTMLDivElement>('.suggestion-container');
    if (suggestionContainer?.isShown()) {
      return;
    }

    if (this.pluginSettingsComponent.settings.isPathIgnored(file.path)) {
      this.consoleDebugComponent.consoleDebug(`File ${file.path} is ignored in plugin settings, skipping`);
      return;
    }

    processFileAbortController = new AbortController();
    this.processFileAbortControllers.set(file.path, processFileAbortController);
    try {
      const combinedAbortSignal = abortSignalAny(this.abortSignalComponent.abortSignal, processFileAbortController.signal);
      const shouldNormalizeFileLinks = this.pluginSettingsComponent.settings.shouldNormalizeFileLinks;
      // The probe parses the note's own CONTENT rather than asking for its cached metadata, and that is a
      // correctness requirement rather than a performance choice. `getCacheSafe()` flushes every dirty
      // `MarkdownView` of the file first, and this probe runs on the automatic triggers — the save patch
      // reaches it while `TextFileView.save()` is still in flight. A plugin that rewrites the editor right
      // after the save (`Linter`'s `Lint on save` inserting YAML attributes is the reported case) then has its
      // insert saved a second time by us, one tick after it landed, which leaves Obsidian's properties
      // section in the editor rendering the frontmatter the file had BEFORE the insert — empty — until the
      // note is closed and reopened. See issue #40. A probe that only decides whether there is anything to
      // convert must not write, and this one now cannot: parsing the content answers the same question with
      // no view, no cache and no save involved. The conversion itself still flushes, because a rewrite that
      // did not would be clobbered by the editor's own next save.
      const content = await this.readContentSafe(file);
      combinedAbortSignal.throwIfAborted();
      if (content === null) {
        return;
      }

      const cache = await parseMetadata(this.app, content, {
        shouldParseExternalLinks: shouldNormalizeFileLinks,
        shouldParseFrontmatterExternalLinks: shouldNormalizeFileLinks,
        shouldParseMultiValueFrontmatterExternalLinks: shouldNormalizeFileLinks
      });
      combinedAbortSignal.throwIfAborted();
      const links = getLinks({ cache });
      const settings = this.pluginSettingsComponent.settings;
      // The same path params `LinkConverter` writes with. A probe that asked for less would answer "no
      // change needed" for a link the converter would have rewritten — a forced relative style with the
      // leading dot on being exactly that case — and the automatic modes would then never fire.
      const linkPathStyleParams = settings.buildLinkPathStyleParams(settings.getLinkPathStyle());
      const needsInternalConversion = links.some((link) =>
        link.original !== convertLink(normalizeOptionalProperties<ConvertLinkParams>({
          app: this.app,
          link,
          linkStyle: getLinkStyleForReference({
            linkStyle: settings.getLinkStyle(),
            reference: link,
            shouldConvertFrontmatterWikilinksToMarkdown: settings.shouldConvertFrontmatterWikilinksToMarkdown
          }),
          newSourcePathOrFile: file,
          ...linkPathStyleParams
        }))
      );
      const needsFileUrlNormalization = shouldNormalizeFileLinks && this.hasFileUrlLink(cache);
      if (needsInternalConversion || needsFileUrlNormalization) {
        await this.linkConverter.convertLinksInFile({
          abortSignal: combinedAbortSignal,
          file
        });
      }
    } finally {
      this.processFileAbortControllers.delete(file.path);
    }
  }

  /**
   * Reads the note's content, tolerating a note that is deleted while the read is in flight.
   *
   * The automatic triggers are all reactions to something that has already happened, so the note can be
   * gone by the time the reaction runs. `getCacheSafe()`, which this probe used to call, answered `null`
   * in that case rather than throwing; keeping that tolerance here is what stops a note deleted mid-save
   * from surfacing as an error notice.
   *
   * @param file - The note to read.
   * @returns The content, or `null` if the note no longer exists.
   */
  private async readContentSafe(file: TFile): Promise<null | string> {
    try {
      return await this.app.vault.cachedRead(file);
    } catch (error) {
      if (file.deleted) {
        return null;
      }

      throw error;
    }
  }
}
