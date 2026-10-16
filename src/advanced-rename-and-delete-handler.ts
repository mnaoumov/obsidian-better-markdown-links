import type { SettingsMigrationApi } from '@mnaoumov/obsidian-lib/plugin/settings-migration-api';
import type { TypedApiContract } from '@mnaoumov/typescript-lib/api-contract';

import type { MigratableSettings as AdvancedRenameAndDeleteHandlerMigratableSettings } from './advanced-rename-and-delete-handler-api/api.d.ts';

import { ADVANCED_RENAME_AND_DELETE_HANDLER_API_CONTRACT } from './advanced-rename-and-delete-handler-api/api-contract.ts';

// The plugin that owns rename/delete handling since this plugin's 5.0.0. Shared by the suggestion the plugin
// shows and the settings migration it offers, so the id and the display name are written once.
export const ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_ID = 'advanced-rename-and-delete-handler';

export const ADVANCED_RENAME_AND_DELETE_HANDLER_PLUGIN_NAME = 'Advanced Rename and Delete Handler';

/**
 * The settings this plugin may hand over to that plugin: the subset of the provider's own proposal type that this
 * plugin ever held.
 *
 * The payload half of the handover contract — the envelope around it (`migrateSettings`, who proposed, whether it
 * was applied) comes from `@mnaoumov/obsidian-lib/plugin/settings-migration-api`. Picked from the provider's
 * copied `api.d.ts` rather than restated, so a renamed or retyped setting there fails to compile here.
 */
export type MigratableSettings = Pick<
  AdvancedRenameAndDeleteHandlerMigratableSettings,
  'excludePaths' | 'includePaths' | 'shouldHandleRenames'
>;

/**
 * The contract this plugin expects of that plugin: only `migrateSettings`, kept narrow so a user on the oldest
 * provider that still takes the migration is offered it. The entry is the provider's own, with both schemas.
 */
export const ADVANCED_RENAME_AND_DELETE_HANDLER_MIGRATION_API_CONTRACT: TypedApiContract<SettingsMigrationApi<MigratableSettings>> = {
  migrateSettings: ADVANCED_RENAME_AND_DELETE_HANDLER_API_CONTRACT.migrateSettings
};
