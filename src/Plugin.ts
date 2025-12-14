import type {
  OpenViewState,
  PaneType
} from 'obsidian';
import type { RenameDeleteHandlerSettings } from 'obsidian-dev-utils/obsidian/RenameDeleteHandler';

import {
  TAbstractFile,
  TFile,
  Workspace
} from 'obsidian';
import { abortSignalAny } from 'obsidian-dev-utils/AbortController';
import {
  convertAsyncToSync,
  handleSilentError
} from 'obsidian-dev-utils/Async';
import { SilentError } from 'obsidian-dev-utils/Error';
import {
  noop,
  noopAsync
} from 'obsidian-dev-utils/Function';
import { MARKDOWN_FILE_EXTENSION } from 'obsidian-dev-utils/obsidian/FileSystem';
import { convertLink } from 'obsidian-dev-utils/obsidian/Link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/MetadataCache';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import { registerRenameDeleteHandlers } from 'obsidian-dev-utils/obsidian/RenameDeleteHandler';

import type { PluginTypes } from './PluginTypes.ts';

import { ConvertLinksInEntireVaultCommand } from './Commands/ConvertLinksInEntireVaultCommand.ts';
import { ConvertLinksInFileCommand } from './Commands/ConvertLinksInFileCommand.ts';
import { ConvertLinksInFolderCommand } from './Commands/ConvertLinksInFolderCommand.ts';
import { patchGenerateMarkdownLink } from './GenerateMarkdownLinkExtendedImpl.ts';
import {
  applyLinkChangeUpdates,
  convertLinksInFile
} from './LinkConverter.ts';
import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

type OpenLinkTextFn = Workspace['openLinkText'];

export class Plugin extends PluginBase<PluginTypes> {
  public readonly processFileAbortControllers = new Map<string, AbortController>();

  protected override createSettingsManager(): PluginSettingsManager {
    return new PluginSettingsManager(this);
  }

  protected override createSettingsTab(): null | PluginSettingsTab {
    return new PluginSettingsTab(this);
  }

  protected override async onLayoutReady(): Promise<void> {
    await super.onLayoutReady();

    patchGenerateMarkdownLink(this);

    new ConvertLinksInFileCommand(this).register();
    new ConvertLinksInFolderCommand(this).register();
    new ConvertLinksInEntireVaultCommand(this).register();

    this.registerEvent(this.app.vault.on('modify', convertAsyncToSync(this.handleModify.bind(this))));

    registerRenameDeleteHandlers(this, () => {
      const settings: Partial<RenameDeleteHandlerSettings> = {
        isPathIgnored: (path) => {
          return this.settings.isPathIgnored(path);
        },
        shouldHandleRenames: this.settings.shouldAutomaticallyUpdateLinksOnRenameOrMove,
        shouldUpdateFileNameAliases: true
      };
      return settings;
    });

    this.app.fileManager.linkUpdaters[MARKDOWN_FILE_EXTENSION] = {
      applyUpdates: (file, updates): Promise<void> => applyLinkChangeUpdates(this, file, updates),
      iterateReferences: noop,
      renameSubpath: noopAsync
    };

    this.register(() => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- This is a valid use of delete.
      delete this.app.fileManager.linkUpdaters[MARKDOWN_FILE_EXTENSION];
    });

    const that = this;
    registerPatch(this, Workspace.prototype, {
      openLinkText: (next: OpenLinkTextFn): OpenLinkTextFn =>
        function openLinkText(this: Workspace, linktext: string, sourcePath: string, newLeaf?: boolean | PaneType, openViewState?: OpenViewState) {
          return that.openLinkText(next, this, linktext, sourcePath, newLeaf, openViewState);
        }
    });
  }

  private async handleModify(file: TAbstractFile): Promise<void> {
    this.abortSignal.throwIfAborted();

    if (!(file instanceof TFile)) {
      return;
    }

    let processFileAbortController = this.processFileAbortControllers.get(file.path);
    processFileAbortController?.abort(new SilentError(`File ${file.path} is already being processed`));
    this.processFileAbortControllers.delete(file.path);

    if (!this.settings.shouldAutomaticallyConvertNewLinks) {
      return;
    }

    const suggestionContainer = document.querySelector<HTMLDivElement>('.suggestion-container');
    if (suggestionContainer && suggestionContainer.style.display !== 'none') {
      return;
    }

    processFileAbortController = new AbortController();
    this.processFileAbortControllers.set(file.path, processFileAbortController);
    try {
      const combinedAbortSignal = abortSignalAny(this.abortSignal, processFileAbortController.signal);
      const cache = await getCacheSafe(this.app, file);
      combinedAbortSignal.throwIfAborted();
      if (!cache) {
        return;
      }
      const links = getAllLinks(cache);
      if (
        links.some((link) =>
          link.original !== convertLink({
            app: this.app,
            link,
            linkStyle: this.settings.getLinkStyle(true),
            newSourcePathOrFile: file
          })
        )
      ) {
        await convertLinksInFile(this, file, combinedAbortSignal);
      }
    } finally {
      this.processFileAbortControllers.delete(file.path);
    }
  }

  private async openLinkText(
    next: OpenLinkTextFn,
    workspace: Workspace,
    linktext: string,
    sourcePath: string,
    newLeaf?: boolean | PaneType,
    openViewState?: OpenViewState
  ): Promise<void> {
    await next.call(workspace, linktext, sourcePath, newLeaf, openViewState);
    const sourceFile = this.app.vault.getFileByPath(sourcePath);
    if (!sourceFile) {
      return;
    }

    try {
      await this.handleModify(sourceFile);
    } catch (error) {
      if (handleSilentError(error)) {
        return;
      }
      throw error;
    }
  }
}
