import type {
  App,
  TFile,
  TFolder
} from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { EditorLockComponent } from 'obsidian-dev-utils/obsidian/editor-lock';

import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
import { getMarkdownFiles } from 'obsidian-dev-utils/obsidian/file-system';
import { updateLinksInFile } from 'obsidian-dev-utils/obsidian/link';
import { loop } from 'obsidian-dev-utils/obsidian/loop';
import { confirm } from 'obsidian-dev-utils/obsidian/modals/confirm';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

interface LinkConverterConstructorParams {
  readonly abortSignalComponent: AbortSignalComponent;
  readonly app: App;
  readonly editorLockComponent: EditorLockComponent;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface LinkConverterConvertLinksInFileParams {
  readonly abortSignal?: AbortSignal;
  readonly file: TFile;
  readonly shouldPromptForExcludedFile?: boolean;
}

interface LinkConverterConvertLinksInFolderParams {
  readonly abortSignal?: AbortSignal;
  readonly folder: TFolder;
}

export class LinkConverter {
  private readonly abortSignalComponent: AbortSignalComponent;
  private readonly app: App;
  private readonly editorLockComponent: EditorLockComponent;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: LinkConverterConstructorParams) {
    this.abortSignalComponent = params.abortSignalComponent;
    this.app = params.app;
    this.editorLockComponent = params.editorLockComponent;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
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

    await updateLinksInFile({
      abortSignal,
      app: this.app,
      editorLockComponent: this.editorLockComponent,
      linkStyle: settings.getLinkStyle(true),
      newSourcePathOrFile: params.file
    });
  }

  public async convertLinksInFolder(params: LinkConverterConvertLinksInFolderParams): Promise<void> {
    const abortSignal = abortSignalAny(this.abortSignalComponent.abortSignal, params.abortSignal);
    await loop({
      abortSignal,
      buildNoticeMessage: (file, iterationStr) => `Converting links in note ${iterationStr} - ${file.path}`,
      items: getMarkdownFiles({
        app: this.app,
        isRecursive: true,
        pathOrFolder: params.folder
      }),
      pluginNoticeComponent: this.pluginNoticeComponent,
      processItem: async (file) => {
        await this.convertLinksInFile({
          abortSignal,
          file
        });
      },
      progressBarTitle: params.folder.path === '/'
        ? 'Better Markdown Links: Converting links in entire vault...'
        : `Better Markdown Links: Converting links in folder "${params.folder.path}" ...`,
      shouldContinueOnError: true,
      shouldShowProgressBar: true
    });
  }
}
