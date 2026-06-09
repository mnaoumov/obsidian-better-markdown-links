import type {
  App,
  OpenViewState,
  PaneType,
  PluginManifest
} from 'obsidian';
import type { RenameDeleteHandlerSettings } from 'obsidian-dev-utils/obsidian/components/rename-delete-handler-component';

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
import { AppActiveFileProvider } from 'obsidian-dev-utils/obsidian/active-file-provider';
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
import { PluginCommandRegistrar } from 'obsidian-dev-utils/obsidian/command-registrar';
import { CallbackLayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';
import { MenuEventRegistrarComponent } from 'obsidian-dev-utils/obsidian/components/menu-event-registrar-component';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { RenameDeleteHandlerComponent } from 'obsidian-dev-utils/obsidian/components/rename-delete-handler-component';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { convertLink } from 'obsidian-dev-utils/obsidian/link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/metadata-cache';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import { PluginEventSourceImpl } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { ConvertLinksInEntireVaultCommandHandler } from './commands/convert-links-in-entire-vault-command-handler.ts';
import { ConvertLinksInFileCommandHandler } from './commands/convert-links-in-file-command-handler.ts';
import { ConvertLinksInFolderCommandHandler } from './commands/convert-links-in-folder-command-handler.ts';
import { patchGenerateMarkdownLink } from './generate-markdown-link-extended-impl.ts';
import { convertLinksInFile } from './link-converter.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

type OpenLinkTextFn = Workspace['openLinkText'];

export class Plugin extends PluginBase {
  public readonly pluginSettingsComponent: PluginSettingsComponent;

  public readonly processFileAbortControllers = new Map<string, AbortController>();

  public get abortSignal(): AbortSignal {
    return this.abortSignalComponent.abortSignal;
  }

  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );
    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab: new PluginSettingsTab({
          plugin: this,
          pluginSettingsComponent: this.pluginSettingsComponent
        })
      })
    );
    /* v8 ignore start -- callback is invoked by Obsidian when layout is ready. */
    this.addChild(
      new CallbackLayoutReadyComponent(app, () => {
        this.onLayoutReady();
      })
    );
    /* v8 ignore stop */
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
      this.consoleDebugComponent.consoleDebug(`File ${file.path} is ignored in plugin settings, skipping`);
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

  private onLayoutReady(): void {
    /* v8 ignore start -- settings getter callback is invoked at runtime by the patched function. */
    patchGenerateMarkdownLink(this, () => this.pluginSettingsComponent.settings);
    /* v8 ignore stop */

    const menuEventRegistrar = this.addChild(new MenuEventRegistrarComponent(this.app));
    this.addChild(
      new CommandHandlerComponent({
        activeFileProvider: new AppActiveFileProvider(this.app),
        commandHandlers: [
          new ConvertLinksInFileCommandHandler(this),
          new ConvertLinksInFolderCommandHandler(this),
          new ConvertLinksInEntireVaultCommandHandler(this)
        ],
        commandRegistrar: new PluginCommandRegistrar(this),
        menuEventRegistrar,
        pluginName: this.manifest.name
      })
    );

    this.registerEvent(this.app.vault.on('modify', convertAsyncToSync(this.handleModify.bind(this))));

    this.addChild(
      new RenameDeleteHandlerComponent({
        abortSignalComponent: this.abortSignalComponent,
        app: this.app,
        pluginId: this.manifest.id,
        settingsBuilder: (): Partial<RenameDeleteHandlerSettings> => {
          return {
            isPathIgnored: (path): boolean => {
              return this.pluginSettingsComponent.settings.isPathIgnored(path);
            },
            shouldHandleRenames: this.pluginSettingsComponent.settings.shouldAutomaticallyUpdateLinksOnRenameOrMove,
            shouldUpdateFileNameAliases: true
          };
        }
      })
    );

    const that = this;
    const patch = this.addChild(new MonkeyAroundComponent());
    /* v8 ignore start -- monkey-around wrapper runs in Obsidian runtime context. */
    patch.registerPatch(Workspace.prototype, {
      openLinkText: (next: OpenLinkTextFn): OpenLinkTextFn =>
        function openLinkText(this: Workspace, linktext: string, sourcePath: string, newLeaf?: boolean | PaneType, openViewState?: OpenViewState) {
          return that.openLinkText(next, this, linktext, sourcePath, newLeaf, openViewState);
        }
    });
    /* v8 ignore stop */
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
