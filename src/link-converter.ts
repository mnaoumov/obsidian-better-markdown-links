import type {
  App,
  TFile,
  TFolder
} from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type {
  UpdateFileUrlLinksInFileParams,
  UpdateLinksInFileParams
} from 'obsidian-dev-utils/obsidian/link';
import type { OffsetRange } from 'obsidian-dev-utils/obsidian/reference';
import type { ResourceLockComponent } from 'obsidian-dev-utils/obsidian/resource-lock';

import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
import { normalizeOptionalProperties } from 'obsidian-dev-utils/object-utils';
import { getMarkdownFiles } from 'obsidian-dev-utils/obsidian/file-system';
import {
  LinkPathStyle,
  LinkStyle,
  updateFileUrlLinksInFile,
  updateLinksInFile
} from 'obsidian-dev-utils/obsidian/link';
import { loop } from 'obsidian-dev-utils/obsidian/loop';
import { confirm } from 'obsidian-dev-utils/obsidian/modals/confirm';
import { readSafe } from 'obsidian-dev-utils/obsidian/vault';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { ResolveUnresolvedLinksInFileParams } from './unresolved-link-resolver.ts';

import { resolveUnresolvedLinksInFile } from './unresolved-link-resolver.ts';

interface GetConversionSubjectParams {
  readonly shouldForceMarkdownLinkStyle: boolean;
  readonly shouldForceRelativeLinkPathStyle: boolean;
}

interface LinkConverterConstructorParams {
  readonly abortSignalComponent: AbortSignalComponent;
  readonly app: App;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly resourceLockComponent: ResourceLockComponent;
}

interface LinkConverterConvertLinksInFileParams {
  readonly abortSignal?: AbortSignal;
  readonly file: TFile;

  /**
   * A character range within the file's content to confine the conversion to.
   *
   * Set by the `in selection` commands, which pass the editor selection. Containment is total: a link only
   * partly covered by the range is left alone, because rewriting part of a link corrupts it. A range also
   * excludes every reference with no position in the file's content — frontmatter links and every canvas
   * reference — so it is only ever meaningful for the body of a note.
   *
   * The range describes the content as it is BEFORE the conversion. The conversion runs up to three passes
   * over the file and each can change the length of the links it rewrites, so the range is carried from one
   * pass to the next by {@link shiftOffsetRangeEnd} rather than reused verbatim.
   *
   * @default `undefined`, meaning the whole file.
   */
  readonly offsetRange?: OffsetRange;

  /**
   * Whether to write markdown links regardless of the `Link style` setting.
   *
   * Set by the `Convert links to Markdown` commands, which exist so a vault that normally preserves its
   * existing style can still force markdown for one run.
   *
   * @default `false`
   */
  readonly shouldForceMarkdownLinkStyle?: boolean;

  /**
   * Whether to write paths relative to the note regardless of the `Link path style` setting.
   *
   * Set by the `Convert link paths to relative` commands, which exist so a vault that normally follows
   * Obsidian's own `New link format` setting can still force relative paths for one run.
   *
   * @default `false`
   */
  readonly shouldForceRelativeLinkPathStyle?: boolean;

  readonly shouldPromptForExcludedFile?: boolean;

  /**
   * Whether to first repoint wikilinks that Obsidian cannot resolve, per the
   * `Should resolve links via aliases` / `Should create missing notes` settings.
   *
   * Set by the explicit convert commands only. The automatic conversion paths must never enable it:
   * creating notes on every auto-save or every file modification would litter the vault.
   *
   * @default `false`
   */
  readonly shouldResolveUnresolvedLinks?: boolean;
}

interface LinkConverterConvertLinksInFolderParams {
  readonly abortSignal?: AbortSignal;
  readonly folder: TFolder;

  /**
   * See {@link LinkConverterConvertLinksInFileParams.shouldForceMarkdownLinkStyle}.
   *
   * @default `false`
   */
  readonly shouldForceMarkdownLinkStyle?: boolean;

  /**
   * See {@link LinkConverterConvertLinksInFileParams.shouldForceRelativeLinkPathStyle}.
   *
   * @default `false`
   */
  readonly shouldForceRelativeLinkPathStyle?: boolean;

  /**
   * See {@link LinkConverterConvertLinksInFileParams.shouldResolveUnresolvedLinks}.
   *
   * @default `false`
   */
  readonly shouldResolveUnresolvedLinks?: boolean;
}

export class LinkConverter {
  private readonly abortSignalComponent: AbortSignalComponent;
  private readonly app: App;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly resourceLockComponent: ResourceLockComponent;

  public constructor(params: LinkConverterConstructorParams) {
    this.abortSignalComponent = params.abortSignalComponent;
    this.app = params.app;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.resourceLockComponent = params.resourceLockComponent;
  }

  public async convertLinksInFile(params: LinkConverterConvertLinksInFileParams): Promise<void> {
    const abortSignal = abortSignalAny(this.abortSignalComponent.abortSignal, params.abortSignal);
    abortSignal.throwIfAborted();
    const settings = this.pluginSettingsComponent.settings;

    if (settings.isPathIgnored(params.file.path)) {
      if (!params.shouldPromptForExcludedFile) {
        return;
      }

      const shouldConvert = await confirm({
        app: this.app,
        message: `Note '${params.file.path}' is excluded from the conversion in plugin settings. Do you want to convert it anyway?`
      });
      if (!shouldConvert) {
        return;
      }
    }

    let offsetRange = params.offsetRange;
    // `readSafe` saves a dirty editor before reading, so this is the length of the content the first pass
    // is about to read — the same content the editor selection was measured against.
    let contentLength = offsetRange ? await this.getContentLength(params.file) : 0;

    const carryOffsetRange = async (): Promise<void> => {
      if (!offsetRange) {
        return;
      }

      const newContentLength = await this.getContentLength(params.file);
      offsetRange = shiftOffsetRangeEnd(offsetRange, newContentLength - contentLength);
      contentLength = newContentLength;
    };

    if (params.shouldResolveUnresolvedLinks && (settings.shouldResolveLinksViaAliases || settings.shouldCreateMissingNotes)) {
      await resolveUnresolvedLinksInFile(normalizeOptionalProperties<ResolveUnresolvedLinksInFileParams>({
        abortSignal,
        app: this.app,
        file: params.file,
        offsetRange,
        pluginNoticeComponent: this.pluginNoticeComponent,
        resourceLockComponent: this.resourceLockComponent,
        shouldCreateMissingNotes: settings.shouldCreateMissingNotes,
        shouldResolveLinksViaAliases: settings.shouldResolveLinksViaAliases
      }));
      await carryOffsetRange();
    }

    await updateLinksInFile(normalizeOptionalProperties<UpdateLinksInFileParams>({
      abortSignal,
      app: this.app,
      linkStyle: params.shouldForceMarkdownLinkStyle ? LinkStyle.Markdown : settings.getLinkStyle(),
      newSourcePathOrFile: params.file,
      offsetRange,
      pluginNoticeComponent: this.pluginNoticeComponent,
      resourceLockComponent: this.resourceLockComponent,
      ...settings.buildLinkPathStyleParams(
        params.shouldForceRelativeLinkPathStyle ? LinkPathStyle.RelativePathToTheSource : settings.getLinkPathStyle()
      )
    }));

    if (!settings.shouldNormalizeFileLinks) {
      return;
    }

    await carryOffsetRange();
    await updateFileUrlLinksInFile(normalizeOptionalProperties<UpdateFileUrlLinksInFileParams>({
      abortSignal,
      app: this.app,
      offsetRange,
      pathOrFile: params.file,
      pluginNoticeComponent: this.pluginNoticeComponent,
      resourceLockComponent: this.resourceLockComponent,
      shouldUseAngleBrackets: settings.shouldUseAngleBrackets
    }));
  }

  public async convertLinksInFolder(params: LinkConverterConvertLinksInFolderParams): Promise<void> {
    const abortSignal = abortSignalAny(this.abortSignalComponent.abortSignal, params.abortSignal);
    const shouldForceMarkdownLinkStyle = params.shouldForceMarkdownLinkStyle ?? false;
    const shouldForceRelativeLinkPathStyle = params.shouldForceRelativeLinkPathStyle ?? false;
    const what = getConversionSubject({
      shouldForceMarkdownLinkStyle,
      shouldForceRelativeLinkPathStyle
    });
    await loop({
      abortSignal,
      buildNoticeMessage: ({ item, iterationString }) => `Converting ${what} in note ${iterationString} - ${item.path}`,
      items: getMarkdownFiles({
        app: this.app,
        isRecursive: true,
        pathOrFolder: params.folder
      }),
      pluginNoticeComponent: this.pluginNoticeComponent,
      processItem: async (file) => {
        await this.convertLinksInFile({
          abortSignal,
          file,
          shouldForceMarkdownLinkStyle,
          shouldForceRelativeLinkPathStyle,
          shouldResolveUnresolvedLinks: params.shouldResolveUnresolvedLinks ?? false
        });
      },
      progressBarTitle: params.folder.path === '/'
        ? `Better Markdown Links: Converting ${what} in entire vault...`
        : `Better Markdown Links: Converting ${what} in folder "${params.folder.path}" ...`,
      shouldContinueOnError: true,
      shouldShowProgressBar: true
    });
  }

  private async getContentLength(file: TFile): Promise<number> {
    const content = await readSafe(this.app, file);
    return content?.length ?? 0;
  }
}

/**
 * The noun the progress bar and the per-note notice use for one folder run.
 *
 * No command sets both flags, so the order below only decides what an unreachable combination would say.
 *
 * @param params - See {@link GetConversionSubjectParams}.
 * @returns The noun, ready to be interpolated after `Converting `.
 */
function getConversionSubject(params: GetConversionSubjectParams): string {
  if (params.shouldForceMarkdownLinkStyle) {
    return 'links to Markdown';
  }

  return params.shouldForceRelativeLinkPathStyle ? 'link paths to relative' : 'links';
}

/**
 * Carries a range across one pass that rewrote only references inside it.
 *
 * A range pass never touches text outside the range — a reference is rewritten only when the range holds it
 * whole — so everything before the start and after the end is unchanged afterwards. The start stays put and
 * the end moves by exactly the change in the content's length. Reusing the original range instead would let
 * a lengthened link push the selection's last link out of it, and a shortened one pull the next, unselected,
 * link in.
 *
 * @param offsetRange - The range as it was before the pass.
 * @param lengthDelta - The content's length after the pass minus its length before.
 * @returns The same stretch of text, measured against the content after the pass.
 */
function shiftOffsetRangeEnd(offsetRange: OffsetRange, lengthDelta: number): OffsetRange {
  return {
    endOffset: offsetRange.endOffset + lengthDelta,
    startOffset: offsetRange.startOffset
  };
}
