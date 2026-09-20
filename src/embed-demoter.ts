import type {
  App,
  TFile,
  TFolder
} from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { EditLinksParams } from 'obsidian-dev-utils/obsidian/link';
import type { OffsetRange } from 'obsidian-dev-utils/obsidian/reference';
import type { ResourceLockComponent } from 'obsidian-dev-utils/obsidian/resource-lock';

import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
import { normalizeOptionalProperties } from 'obsidian-dev-utils/object-utils';
import { getMarkdownFiles } from 'obsidian-dev-utils/obsidian/file-system';
import {
  editLinks,
  extractLinkFile,
  generateMarkdownLink,
  hasEmbedSyntax
} from 'obsidian-dev-utils/obsidian/link';
import { loop } from 'obsidian-dev-utils/obsidian/loop';
import { confirm } from 'obsidian-dev-utils/obsidian/modals/confirm';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

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

    await editLinks(normalizeOptionalProperties<EditLinksParams>({
      abortSignal,
      app: this.app,
      linkConverter: (link) => {
        if (!hasEmbedSyntax(link.original)) {
          return;
        }

        const linkFile = extractLinkFile({
          app: this.app,
          link,
          sourcePathOrFile: file
        });

        if (!linkFile) {
          return;
        }

        const linkMarkdown = generateMarkdownLink({
          alias: link.displayText ?? '',
          app: this.app,
          isEmbed: false,
          originalLink: link.original,
          sourcePathOrFile: file,
          targetPathOrFile: linkFile
        });

        return settings.shouldAppendFileNameWhenDemotingEmbeds ? `${linkMarkdown}\n  - ${linkFile.name}` : linkMarkdown;
      },
      offsetRange: params.offsetRange,
      pathOrFile: file,
      pluginNoticeComponent: this.pluginNoticeComponent,
      resourceLockComponent: this.resourceLockComponent
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
        ? 'Better Markdown Links: Demoting embeds to links in entire vault...'
        : `Better Markdown Links: Demoting embeds to links in folder "${params.folder.path}" ...`,
      shouldContinueOnError: true,
      shouldShowProgressBar: true
    });
  }
}
