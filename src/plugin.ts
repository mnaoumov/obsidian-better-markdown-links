import type { PluginApiDeclaration } from '@mnaoumov/obsidian-lib/plugin/plugin-api';

import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import { PluginSuggestionComponent } from '@mnaoumov/obsidian-lib/components/plugin-suggestion-component';
import { SettingsMigrationComponent } from '@mnaoumov/obsidian-lib/components/settings-migration-component';
import { PluginDataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';
import { PluginBase } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { PluginEventSourceImpl } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import type { MigratableSettings } from './rename-delete-handover/advanced-rename-and-delete-handler.ts';

import { BetterMarkdownLinksComponent } from './automatic-conversion/better-markdown-links-component.ts';
import { ConvertLinkPathsToRelativeInEntireVaultCommandHandler } from './commands/convert-link-paths-to-relative/convert-link-paths-to-relative-in-entire-vault-command-handler.ts';
import { ConvertLinkPathsToRelativeInFileCommandHandler } from './commands/convert-link-paths-to-relative/convert-link-paths-to-relative-in-file-command-handler.ts';
import { ConvertLinkPathsToRelativeInFolderCommandHandler } from './commands/convert-link-paths-to-relative/convert-link-paths-to-relative-in-folder-command-handler.ts';
import { ConvertLinkPathsToRelativeInSelectionCommandHandler } from './commands/convert-link-paths-to-relative/convert-link-paths-to-relative-in-selection-command-handler.ts';
import { ConvertLinksToMarkdownInEntireVaultCommandHandler } from './commands/convert-links-to-markdown/convert-links-to-markdown-in-entire-vault-command-handler.ts';
import { ConvertLinksToMarkdownInFileCommandHandler } from './commands/convert-links-to-markdown/convert-links-to-markdown-in-file-command-handler.ts';
import { ConvertLinksToMarkdownInFolderCommandHandler } from './commands/convert-links-to-markdown/convert-links-to-markdown-in-folder-command-handler.ts';
import { ConvertLinksToMarkdownInSelectionCommandHandler } from './commands/convert-links-to-markdown/convert-links-to-markdown-in-selection-command-handler.ts';
import { ConvertLinksInEntireVaultCommandHandler } from './commands/convert-links/convert-links-in-entire-vault-command-handler.ts';
import { ConvertLinksInFileCommandHandler } from './commands/convert-links/convert-links-in-file-command-handler.ts';
import { ConvertLinksInFolderCommandHandler } from './commands/convert-links/convert-links-in-folder-command-handler.ts';
import { ConvertLinksInSelectionCommandHandler } from './commands/convert-links/convert-links-in-selection-command-handler.ts';
import { DemoteEmbedsInEntireVaultCommandHandler } from './commands/demote-embeds/demote-embeds-in-entire-vault-command-handler.ts';
import { DemoteEmbedsInFileCommandHandler } from './commands/demote-embeds/demote-embeds-in-file-command-handler.ts';
import { DemoteEmbedsInFolderCommandHandler } from './commands/demote-embeds/demote-embeds-in-folder-command-handler.ts';
import { DemoteEmbedsInSelectionCommandHandler } from './commands/demote-embeds/demote-embeds-in-selection-command-handler.ts';
import { EmbedDemoter } from './conversion/embed-demoter.ts';
import { LinkConverter } from './conversion/link-converter.ts';
import { PluginApiImpl } from './link-generation/plugin-api-impl.ts';
import {
  PLUGIN_API_CONTRACT,
  PLUGIN_API_VERSION
} from './link-generation/plugin-api.ts';
import {
  ADVANCED_RENAME_AND_DELETE_HANDLER_MIGRATION_API_CONTRACT,
  ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_ID,
  ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_NAME
} from './rename-delete-handover/advanced-rename-and-delete-handler.ts';
import { PluginSettingsComponent } from './settings/plugin-settings-component.ts';
import { PluginSettingsTab } from './settings/plugin-settings-tab.ts';

export class Plugin extends PluginBase {
  private pluginApi: null | PluginApiImpl = null;

  /**
   * Declares this plugin's API for the base to publish.
   *
   * Published by the base rather than by hand: the `plugin-loaded` broadcast's `apiVersions` is derived from this method alone,
   * so a hand `publishPluginApi` call would announce this plugin as publishing no API at all.
   *
   * @returns The declaration, or none before the plugin has loaded.
   */
  protected override getPluginApis(): PluginApiDeclaration[] {
    return this.pluginApi
      ? [
        {
          api: this.pluginApi,
          apiVersion: PLUGIN_API_VERSION,
          contract: PLUGIN_API_CONTRACT
        }
      ]
      : [];
  }

  protected override async onloadImpl(): Promise<void> {
    this.pluginApi = new PluginApiImpl({
      app: this.app
    });

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
        pluginSettingsComponent,
        reason: buildSuggestionReason(this.manifest.name),
        // `editAndSave`, not `setProperty`: a decline has to outlive a reload, and `setProperty` only edits
        // the in-memory state.
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
      new SettingsMigrationComponent<MigratableSettings>({
        apiVersionRange: '^1',
        app: this.app,
        contract: ADVANCED_RENAME_AND_DELETE_HANDLER_MIGRATION_API_CONTRACT,
        getProposedSettings: (): MigratableSettings | null => {
          const settings = pluginSettingsComponent.settings;

          // The path settings travel with the toggle: they scoped this plugin's own handler, so they are
          // what the vault-wide handler needs to keep behaving the way this plugin did. They are proposed
          // rather than moved — this plugin keeps its own copies, which still scope link conversion.
          return settings.proposedShouldHandleRenames === null
            ? null
            : {
              excludePaths: settings.excludePaths,
              includePaths: settings.includePaths,
              shouldHandleRenames: settings.proposedShouldHandleRenames
            };
        },
        pluginSettingsComponent,
        providerPluginId: ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_ID,
        retireProposedSettings: async (): Promise<void> => {
          await pluginSettingsComponent.editAndSave((settings) => {
            settings.proposedShouldHandleRenames = null;
          });
        },
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
      new ConvertLinksInSelectionCommandHandler({
        linkConverter
      }),
      new ConvertLinksToMarkdownInFileCommandHandler({
        linkConverter
      }),
      new ConvertLinksToMarkdownInFolderCommandHandler({
        linkConverter
      }),
      new ConvertLinksToMarkdownInEntireVaultCommandHandler({
        app: this.app,
        linkConverter
      }),
      new ConvertLinksToMarkdownInSelectionCommandHandler({
        linkConverter
      }),
      new ConvertLinkPathsToRelativeInFileCommandHandler({
        linkConverter
      }),
      new ConvertLinkPathsToRelativeInFolderCommandHandler({
        linkConverter
      }),
      new ConvertLinkPathsToRelativeInEntireVaultCommandHandler({
        app: this.app,
        linkConverter
      }),
      new ConvertLinkPathsToRelativeInSelectionCommandHandler({
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
      new DemoteEmbedsInSelectionCommandHandler({
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

function buildSuggestionReason(pluginName: string): DocumentFragment {
  return createFragment((f) => {
    appendCodeBlock(f, pluginName);
    f.appendText(' no longer handles renames itself. Without ');
    appendCodeBlock(f, ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_NAME);
    f.appendText(', Obsidian\'s own link update runs instead, and it does not write the readable link format this plugin generates.');
  });
}
