import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { PluginSuggestionComponent } from 'obsidian-dev-utils/obsidian/components/plugin-suggestion-component';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import { PluginEventSourceImpl } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import {
  ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_ID,
  ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_NAME
} from './advanced-rename-and-delete-handler.ts';
import { BetterMarkdownLinksComponent } from './better-markdown-links-component.ts';
import { ConvertLinksInEntireVaultCommandHandler } from './commands/convert-links-in-entire-vault-command-handler.ts';
import { ConvertLinksInFileCommandHandler } from './commands/convert-links-in-file-command-handler.ts';
import { ConvertLinksInFolderCommandHandler } from './commands/convert-links-in-folder-command-handler.ts';
import { DemoteEmbedsInEntireVaultCommandHandler } from './commands/demote-embeds-in-entire-vault-command-handler.ts';
import { DemoteEmbedsInFileCommandHandler } from './commands/demote-embeds-in-file-command-handler.ts';
import { DemoteEmbedsInFolderCommandHandler } from './commands/demote-embeds-in-folder-command-handler.ts';
import { EmbedDemoter } from './embed-demoter.ts';
import { LinkConverter } from './link-converter.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { RenameDeleteHandlerMigrationComponent } from './rename-delete-handler-migration-component.ts';

const SUGGESTION_REASON = 'Better Markdown Links no longer handles renames itself.'
  + ' Without Advanced Rename and Delete Handler, Obsidian\'s own link update runs instead,'
  + ' and it does not write the readable link format this plugin generates.';

export class Plugin extends PluginBase {
  protected override async onloadImpl(): Promise<void> {
    const pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );
    this.pluginSettingsComponent = pluginSettingsComponent;

    const pluginSuggestionComponent = this.addChild(
      new PluginSuggestionComponent({
        app: this.app,
        isSuggestionDeclined: (): boolean => pluginSettingsComponent.settings.isAdvancedRenameAndDeleteHandlerSuggestionDeclined,
        pluginNoticeComponent: this.pluginNoticeComponent,
        reason: SUGGESTION_REASON,
        // `editAndSave`, not `setProperty`: a decline has to outlive a reload, and `setProperty` only edits
        // The in-memory state.
        setSuggestionDeclined: async (isDeclined): Promise<void> => {
          await pluginSettingsComponent.editAndSave((settings) => {
            settings.isAdvancedRenameAndDeleteHandlerSuggestionDeclined = isDeclined;
          });
        },
        suggestedPluginId: ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_ID,
        suggestedPluginName: ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_NAME
      })
    );

    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab: new PluginSettingsTab({
          plugin: this,
          pluginSettingsComponent,
          pluginSuggestionComponent
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

    const embedDemoter = new EmbedDemoter({
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
      new RenameDeleteHandlerMigrationComponent({
        app: this.app,
        pluginSettingsComponent,
        sourcePluginId: this.manifest.id
      })
    );

    await this.commandHandlerComponent.registerCommandHandlers(() => [
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
      new DemoteEmbedsInFileCommandHandler({
        embedDemoter
      }),
      new DemoteEmbedsInFolderCommandHandler({
        embedDemoter
      }),
      new DemoteEmbedsInEntireVaultCommandHandler({
        app: this.app,
        embedDemoter
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
