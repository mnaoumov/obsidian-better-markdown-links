import type { App } from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { ConsoleDebugComponent } from 'obsidian-dev-utils/obsidian/components/console-debug-component';
import type { GenerateMarkdownLinkParams } from 'obsidian-dev-utils/obsidian/link';
import type { CachedMetadataEx } from 'obsidian-dev-utils/obsidian/metadata-cache';

import {
  TAbstractFile,
  TFile
} from 'obsidian';
import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
import { convertAsyncToSync } from 'obsidian-dev-utils/async';
import { SilentError } from 'obsidian-dev-utils/error';
import { GenerateMarkdownLinkDefaultParamsComponent } from 'obsidian-dev-utils/obsidian/components/generate-markdown-link-default-params-component';
import { LayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';
import { convertLink } from 'obsidian-dev-utils/obsidian/link';
import {
  getCacheSafe,
  getLinks
} from 'obsidian-dev-utils/obsidian/metadata-cache';

import type { LinkConverter } from './link-converter.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { GenerateMarkdownLinkPatchComponent } from './generate-markdown-link-extended-impl.ts';
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
          return {
            isEmptyEmbedAliasAllowed: settings.shouldAllowEmptyEmbedAlias,
            shouldIncludeAttachmentExtensionToEmbedAlias: settings.shouldIncludeAttachmentExtensionToEmbedAlias,
            shouldUseAngleBrackets: settings.shouldUseAngleBrackets,
            shouldUseLeadingDotForRelativePaths: settings.shouldUseLeadingDotForRelativePaths,
            shouldUseLeadingSlashForAbsolutePaths: settings.shouldUseLeadingSlashForAbsolutePaths
          };
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

    if (!(file instanceof TFile)) {
      return;
    }

    if (!this.pluginSettingsComponent.settings.shouldConvertLinksOnModify()) {
      return;
    }

    await this.processFile(file);
  }

  private hasFileUrlLink(cache: CachedMetadataEx): boolean {
    const externalLinks = [
      ...cache.externalLinks ?? [],
      ...cache.frontmatterExternalLinks ?? []
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
      const cache = await getCacheSafe(this.app, file, {
        shouldParseExternalLinks: shouldNormalizeFileLinks,
        shouldParseFrontmatterExternalLinks: shouldNormalizeFileLinks
      });
      combinedAbortSignal.throwIfAborted();
      if (!cache) {
        return;
      }
      const links = getLinks({ cache });
      const needsInternalConversion = links.some((link) =>
        link.original !== convertLink({
          app: this.app,
          link,
          linkStyle: this.pluginSettingsComponent.settings.getLinkStyle(true),
          newSourcePathOrFile: file
        })
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
}
