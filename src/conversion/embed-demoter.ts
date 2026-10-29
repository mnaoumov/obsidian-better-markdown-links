import type { AbortSignalComponent } from '@mnaoumov/obsidian-lib/components/abort-signal-component';
import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type {
  EditReferencesParams,
  GenerateMarkdownLinkParams
} from '@mnaoumov/obsidian-lib/link';
import type { OffsetRange } from '@mnaoumov/obsidian-lib/reference';
import type { ResourceLockComponent } from '@mnaoumov/obsidian-lib/resource-lock';
import type {
  App,
  TFile,
  TFolder
} from 'obsidian';

import { getMarkdownFiles } from '@mnaoumov/obsidian-lib/file-system';
import {
  editReferences,
  extractReferenceFile,
  generateMarkdownLink,
  hasEmbedSyntax
} from '@mnaoumov/obsidian-lib/link';
import { loop } from '@mnaoumov/obsidian-lib/loop';
import { confirm } from '@mnaoumov/obsidian-lib/modals/confirm';
import { abortSignalAny } from '@mnaoumov/typescript-lib/abort-controller';
import { normalizeOptionalProperties } from '@mnaoumov/typescript-lib/object-utils';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { getLinkStyleForReference } from './frontmatter-wikilink-style.ts';
import { getLinkTargetExclusionPredicate } from './link-target-exclusion.ts';

interface EmbedDemoterConstructorParams {
  readonly abortSignalComponent: AbortSignalComponent;
  readonly app: App;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly resourceLockComponent: ResourceLockComponent;
}

interface EmbedDemoterDemoteEmbedsInFileParams {
  readonly abortSignal?: AbortSignal;
  readonly file: TFile;

  /**
   * A character range within the file's content to confine the demotion to.
   *
   * Set by the `in selection` command, which passes the editor selection. Both bounds are inclusive and
   * containment is total: an embed only partly covered by the range is left alone, because rewriting part
   * of a link corrupts it.
   *
   * A range also excludes every reference that carries no position within the file's content — frontmatter
   * links, multi-value frontmatter entries and all canvas references — so it is only ever meaningful for
   * the body of a note.
   *
   * @default `undefined`, meaning the whole file.
   */
  readonly offsetRange?: OffsetRange;

  readonly shouldPromptForExcludedFile?: boolean;
}

interface EmbedDemoterDemoteEmbedsInFolderParams {
  readonly abortSignal?: AbortSignal;
  readonly folder: TFolder;
}

/**
 * Demotes embeds to plain links: `![[foo]]` becomes `[[foo]]`, `![alias](foo.md)` becomes `[alias](foo.md)`.
 *
 * This is a conversion of the link's *form*, not of its path style or its wikilink-vs-markdown syntax —
 * those belong to {@link LinkConverter}. The generated link keeps whatever style the embed already had,
 * because {@link generateMarkdownLink} infers the style from `originalLink`.
 *
 * The one exception is the force-Markdown link style, which `BetterMarkdownLinksComponent` registers as a
 * default param for every generated link and which beats that inference: in that mode a wiki embed demotes
 * to a markdown link. That is the mode's point — a vault that has asked for markdown links everywhere.
 * Everywhere but the frontmatter: a wiki embed there stays a wikilink, per
 * {@link getLinkStyleForReference}.
 */
export class EmbedDemoter {
  private readonly abortSignalComponent: AbortSignalComponent;
  private readonly app: App;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly resourceLockComponent: ResourceLockComponent;

  public constructor(params: EmbedDemoterConstructorParams) {
    this.abortSignalComponent = params.abortSignalComponent;
    this.app = params.app;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.resourceLockComponent = params.resourceLockComponent;
  }

  public async demoteEmbedsInFile(params: EmbedDemoterDemoteEmbedsInFileParams): Promise<void> {
    const abortSignal = abortSignalAny(this.abortSignalComponent.abortSignal, params.abortSignal);
    abortSignal.throwIfAborted();
    const settings = this.pluginSettingsComponent.settings;
    const file = params.file;

    if (settings.isPathIgnored(file.path)) {
      if (!params.shouldPromptForExcludedFile) {
        return;
      }

      const shouldDemote = await confirm({
        app: this.app,
        message: `Note '${file.path}' is excluded from the conversion in plugin settings. Do you want to demote its embeds anyway?`
      });
      if (!shouldDemote) {
        return;
      }
    }

    await editReferences(normalizeOptionalProperties<EditReferencesParams>({
      abortSignal,
      app: this.app,
      offsetRange: params.offsetRange,
      pathOrFile: file,
      pluginNoticeComponent: this.pluginNoticeComponent,
      referenceConverter: (link) => {
        if (!hasEmbedSyntax(link.original)) {
          return;
        }

        const linkFile = extractReferenceFile({
          app: this.app,
          reference: link,
          sourcePathOrFile: file
        });

        if (!linkFile) {
          return;
        }

        const linkMarkdown = generateMarkdownLink(normalizeOptionalProperties<GenerateMarkdownLinkParams>({
          alias: link.displayText ?? '',
          app: this.app,
          isEmbed: false,
          // `undefined` for every body reference, which leaves the style to the inference described above.
          linkStyle: getLinkStyleForReference({
            linkStyle: undefined,
            reference: link,
            shouldConvertFrontmatterWikilinksToMarkdown: settings.shouldConvertFrontmatterWikilinksToMarkdown
          }),
          originalLink: link.original,
          sourcePathOrFile: file,
          targetPathOrFile: linkFile
        }));

        return settings.shouldAppendFileNameWhenDemotingEmbeds ? `${linkMarkdown}\n  - ${linkFile.name}` : linkMarkdown;
      },
      resourceLockComponent: this.resourceLockComponent,
      // An embed whose target `excludeLinkTargetPaths` matches stays an embed (issue #45).
      shouldSkipReference: getLinkTargetExclusionPredicate({ app: this.app, settings, sourceFile: file }),
      // An embed inside a heading is part of the heading's text, so demoting it would change the heading and
      // break every `#heading` link to it (issue #44).
      shouldSkipReferencesInHeadings: true
    }));
  }

  public async demoteEmbedsInFolder(params: EmbedDemoterDemoteEmbedsInFolderParams): Promise<void> {
    const abortSignal = abortSignalAny(this.abortSignalComponent.abortSignal, params.abortSignal);
    await loop({
      abortSignal,
      buildNoticeMessage: ({ item, iterationString }) => `Demoting embeds in note ${iterationString} - ${item.path}`,
      items: getMarkdownFiles({
        app: this.app,
        isRecursive: true,
        pathOrFolder: params.folder
      }),
      pluginNoticeComponent: this.pluginNoticeComponent,
      processItem: async (file) => {
        await this.demoteEmbedsInFile({
          abortSignal,
          file
        });
      },
      progressBarTitle: params.folder.path === '/'
        ? 'Demoting embeds to links in entire vault...'
        : `Demoting embeds to links in folder "${params.folder.path}" ...`,
      shouldContinueOnError: true,
      shouldShowProgressBar: true
    });
  }
}
