import type {
  App,
  TFile,
  TFolder
} from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { ResourceLockComponent } from 'obsidian-dev-utils/obsidian/resource-lock';

import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
import { getMarkdownFiles } from 'obsidian-dev-utils/obsidian/file-system';
import {
  LinkPathStyle,
  LinkStyle,
  updateFileUrlLinksInFile,
  updateLinksInFile
} from 'obsidian-dev-utils/obsidian/link';
import { loop } from 'obsidian-dev-utils/obsidian/loop';
import { confirm } from 'obsidian-dev-utils/obsidian/modals/confirm';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

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

    if (params.shouldResolveUnresolvedLinks && (settings.shouldResolveLinksViaAliases || settings.shouldCreateMissingNotes)) {
      await resolveUnresolvedLinksInFile({
        abortSignal,
        app: this.app,
        file: params.file,
        pluginNoticeComponent: this.pluginNoticeComponent,
        resourceLockComponent: this.resourceLockComponent,
        shouldCreateMissingNotes: settings.shouldCreateMissingNotes,
        shouldResolveLinksViaAliases: settings.shouldResolveLinksViaAliases
      });
    }

    await updateLinksInFile({
      abortSignal,
      app: this.app,
      linkStyle: params.shouldForceMarkdownLinkStyle ? LinkStyle.Markdown : settings.getLinkStyle(),
      newSourcePathOrFile: params.file,
      pluginNoticeComponent: this.pluginNoticeComponent,
      resourceLockComponent: this.resourceLockComponent,
      ...settings.buildLinkPathStyleParams(
        params.shouldForceRelativeLinkPathStyle ? LinkPathStyle.RelativePathToTheSource : settings.getLinkPathStyle()
      )
    });

    if (settings.shouldNormalizeFileLinks) {
      await updateFileUrlLinksInFile({
        abortSignal,
        app: this.app,
        pathOrFile: params.file,
        pluginNoticeComponent: this.pluginNoticeComponent,
        resourceLockComponent: this.resourceLockComponent,
        shouldUseAngleBrackets: settings.shouldUseAngleBrackets
      });
    }
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

  if (params.shouldForceRelativeLinkPathStyle) {
    return 'link paths to relative';
  }

  return 'links';
}
