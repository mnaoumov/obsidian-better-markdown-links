import type { RenameDeleteHandlerSettings } from 'obsidian-dev-utils/obsidian/components/rename-delete-handler-component';

import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { RenameDeleteHandlerComponent } from 'obsidian-dev-utils/obsidian/components/rename-delete-handler-component';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import { PluginEventSourceImpl } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { BetterMarkdownLinksComponent } from './better-markdown-links-component.ts';
import { ConvertLinksInEntireVaultCommandHandler } from './commands/convert-links-in-entire-vault-command-handler.ts';
import { ConvertLinksInFileCommandHandler } from './commands/convert-links-in-file-command-handler.ts';
import { ConvertLinksInFolderCommandHandler } from './commands/convert-links-in-folder-command-handler.ts';
import { LinkConverter } from './link-converter.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

export class Plugin extends PluginBase {
  protected override onloadImpl(): void {
    const pluginSettingsComponent = this.addChild(
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
          pluginSettingsComponent
        })
      })
    );

    const linkConverter = new LinkConverter({
      abortSignalComponent: this.abortSignalComponent,
      app: this.app,
      pluginNoticeComponent: this.pluginNoticeComponent,
      pluginSettingsComponent,
      resourceLockComponent: this.resourceLockComponent
    });

    this.addChild(
      new BetterMarkdownLinksComponent({
        abortSignalComponent: this.abortSignalComponent,
        app: this.app,
        consoleDebugComponent: this.consoleDebugComponent,
        linkConverter,
        pluginSettingsComponent
      })
    );

    this.addChild(
      new RenameDeleteHandlerComponent({
        abortSignalComponent: this.abortSignalComponent,
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        resourceLockComponent: this.resourceLockComponent,
        settingsBuilder(): Partial<RenameDeleteHandlerSettings> {
          return {
            isPathIgnored: (path): boolean => {
              return pluginSettingsComponent.settings.isPathIgnored(path);
            },
            shouldHandleRenames: pluginSettingsComponent.settings.shouldAutomaticallyUpdateLinksOnRenameOrMove,
            shouldUpdateFileNameAliases: true
          };
        }
      })
    );

    this.commandHandlerComponent.registerCommandHandlers([
      new ConvertLinksInFileCommandHandler({
        linkConverter
      }),
      new ConvertLinksInFolderCommandHandler({
        linkConverter
      }),
      new ConvertLinksInEntireVaultCommandHandler({
        app: this.app,
        linkConverter
      }),
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }
}
