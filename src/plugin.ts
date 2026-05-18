import type {
  App,
  OpenViewState,
  PaneType,
  PluginManifest
} from 'obsidian';
import type { RenameDeleteHandlerSettings } from 'obsidian-dev-utils/obsidian/rename-delete-handler';

import {
  TAbstractFile,
  TFile,
  Workspace
} from 'obsidian';
import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
import {
  convertAsyncToSync,
  handleSilentError
} from 'obsidian-dev-utils/async';
import { SilentError } from 'obsidian-dev-utils/error';
import { convertLink } from 'obsidian-dev-utils/obsidian/link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/metadata-cache';
import { registerPatch } from 'obsidian-dev-utils/obsidian/monkey-around';
import { CommandComponent } from 'obsidian-dev-utils/obsidian/components/command-component';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import { registerRenameDeleteHandlers } from 'obsidian-dev-utils/obsidian/rename-delete-handler';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';

import { ConvertLinksInEntireVaultCommand } from './commands/convert-links-in-entire-vault-command.ts';
import { ConvertLinksInFileCommand } from './commands/convert-links-in-file-command.ts';
import { ConvertLinksInFolderCommand } from './commands/convert-links-in-folder-command.ts';
import { patchGenerateMarkdownLink } from './generate-markdown-link-extended-impl.ts';
import { convertLinksInFile } from './link-converter.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

type OpenLinkTextFn = Workspace['openLinkText'];

export class Plugin extends PluginBase {
  public readonly processFileAbortControllers = new Map<string, AbortController>();

  public readonly pluginSettingsComponent: PluginSettingsComponent;

  public get abortSignal(): AbortSignal {
    return this.abortSignalComponent.abortSignal;
  }

  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.pluginSettingsComponent = this.addChild(new PluginSettingsComponent(new PluginDataHandler(this)));
    this.addChild(new PluginSettingsTabComponent({
      plugin: this,
      pluginSettingsTab: new PluginSettingsTab({
        plugin: this,
        settingsComponent: this.pluginSettingsComponent
      })
    }));
  }

  protected override async onLayoutReady(): Promise<void> {
    await super.onLayoutReady();

    patchGenerateMarkdownLink(this, () => this.pluginSettingsComponent.settings);

    this.addChild(new CommandComponent(this, new ConvertLinksInFileCommand(this)));
    this.addChild(new CommandComponent(this, new ConvertLinksInFolderCommand(this)));
    this.addChild(new CommandComponent(this, new ConvertLinksInEntireVaultCommand(this)));

    this.registerEvent(this.app.vault.on('modify', convertAsyncToSync(this.handleModify.bind(this))));

    registerRenameDeleteHandlers(this, () => {
      const settings: Partial<RenameDeleteHandlerSettings> = {
        isPathIgnored: (path) => {
          return this.pluginSettingsComponent.settings.isPathIgnored(path);
        },
        shouldHandleRenames: this.pluginSettingsComponent.settings.shouldAutomaticallyUpdateLinksOnRenameOrMove,
        shouldUpdateFileNameAliases: true
      };
      return settings;
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
    this.abortSignalComponent.abortSignal.throwIfAborted();

    if (!(file instanceof TFile)) {
      return;
    }

    let processFileAbortController = this.processFileAbortControllers.get(file.path);
    processFileAbortController?.abort(new SilentError(`File ${file.path} is already being processed`));
    this.processFileAbortControllers.delete(file.path);

    if (!this.pluginSettingsComponent.settings.shouldAutomaticallyConvertNewLinks) {
      return;
    }

    const suggestionContainer = activeDocument.querySelector<HTMLDivElement>('.suggestion-container');
    if (suggestionContainer?.isShown()) {
      return;
    }

    if (this.pluginSettingsComponent.settings.isPathIgnored(file.path)) {
      this.consoleDebugComponent.debug(`File ${file.path} is ignored in plugin settings, skipping`);
      return;
    }

    processFileAbortController = new AbortController();
    this.processFileAbortControllers.set(file.path, processFileAbortController);
    try {
      const combinedAbortSignal = abortSignalAny(this.abortSignalComponent.abortSignal, processFileAbortController.signal);
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
            linkStyle: this.pluginSettingsComponent.settings.getLinkStyle(true),
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
