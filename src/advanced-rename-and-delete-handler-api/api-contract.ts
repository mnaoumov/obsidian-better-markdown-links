/**
 * @file
 *
 * The runtime half of this plugin's published API: its CONTRACT, one entry per method of
 * {@link AdvancedRenameAndDeleteHandlerApi}, each with a schema over the argument list and a schema over the
 * value the method returns (awaited, for `migrateSettings`).
 *
 * This plugin publishes exactly this constant with its API, and a consumer copies it beside `api.d.ts` and
 * passes it as the `contract` when it looks the API up, so both ends validate against ONE definition. The
 * plugin registry checks the payloads against it only while its debugger is on.
 *
 * Copyable: it imports from `./api.d.ts` and from `@mnaoumov/typescript-lib`, which carries the generic half —
 * the contract types, the {@link https://standardschema.dev | Standard Schema} builders and the common guards. So
 * a consumer copying it needs that package; what is left here is this API's own constant and the guards for its
 * own shapes. The constant is typed as `TypedApiContract<AdvancedRenameAndDeleteHandlerApi>`, which checks every
 * entry against its method's signature and requires both schemas on each.
 *
 * It is not named `api.ts`: TypeScript would read `api.d.ts` as that file's own declarations.
 */

import type { TypedApiContract } from '@mnaoumov/typescript-lib/api-contract';

import {
  BOOLEAN_GUARD,
  createArgumentsSchema,
  createTypeGuardSchema,
  defineApiContract,
  STRING_GUARD
} from '@mnaoumov/typescript-lib/api-contract';
import {
  isBoolean,
  isString,
  isStringArray
} from '@mnaoumov/typescript-lib/type-guards';

import type {
  AdvancedRenameAndDeleteHandlerApi,
  EmptyFolderBehavior,
  HandedOverSettings,
  MigratableSettings,
  MigrateSettingsParams,
  MigrateSettingsResult
} from './api.d.ts';

/**
 * The type of {@link ADVANCED_RENAME_AND_DELETE_HANDLER_API_CONTRACT}: one entry per method of
 * {@link AdvancedRenameAndDeleteHandlerApi}, each typed against that method's parameters and awaited return
 * value.
 */
export type AdvancedRenameAndDeleteHandlerApiContract = TypedApiContract<AdvancedRenameAndDeleteHandlerApi>;

type SettingValidators = {
  readonly [TPropertyName in keyof HandedOverSettings]-?: (value: unknown) => value is HandedOverSettings[TPropertyName];
};

const VENDOR = 'advanced-rename-and-delete-handler';

/**
 * Every value {@link EmptyFolderBehavior} can take. Typed as a record over the union so a member added to it in
 * `api.d.ts` fails to compile here until it is listed.
 */
const EMPTY_FOLDER_BEHAVIORS: Readonly<Record<EmptyFolderBehavior, true>> = {
  Delete: true,
  DeleteWithEmptyParents: true,
  Keep: true
};

const SETTING_VALIDATORS: SettingValidators = {
  emptyFolderBehavior: isEmptyFolderBehavior,
  excludePaths: isStringArray,
  includePaths: isStringArray,
  notePriorities: isStringArray,
  shouldDeleteConflictingAttachments: isBoolean,
  shouldHandleDeletions: isBoolean,
  shouldHandleRenames: isBoolean,
  shouldRenameAttachmentFiles: isBoolean,
  shouldRenameAttachmentFolder: isBoolean,
  shouldRescueSharedAttachments: isBoolean,
  shouldUpdateFileNameAliases: isBoolean,
  treatAsAttachmentExtensions: isStringArray
};

const SCHEMA_OPTIONS = { vendor: VENDOR };

const PATH_GUARD = { ...STRING_GUARD, expected: 'a path' };

/**
 * The contract this plugin publishes with {@link AdvancedRenameAndDeleteHandlerApi}, for a consumer to pass as
 * the `contract` when it looks the API up.
 */
export const ADVANCED_RENAME_AND_DELETE_HANDLER_API_CONTRACT: AdvancedRenameAndDeleteHandlerApiContract = defineApiContract<
  AdvancedRenameAndDeleteHandlerApi
>({
  getSettings: {
    input: createArgumentsSchema([], SCHEMA_OPTIONS),
    output: createTypeGuardSchema({ ...SCHEMA_OPTIONS, expected: 'the handed-over settings', typeGuard: isHandedOverSettings })
  },
  isPathIgnored: {
    input: createArgumentsSchema([PATH_GUARD], SCHEMA_OPTIONS),
    output: createTypeGuardSchema({ ...SCHEMA_OPTIONS, ...BOOLEAN_GUARD })
  },
  isTreatedAsAttachment: {
    input: createArgumentsSchema([PATH_GUARD], SCHEMA_OPTIONS),
    output: createTypeGuardSchema({ ...SCHEMA_OPTIONS, ...BOOLEAN_GUARD })
  },
  migrateSettings: {
    input: createArgumentsSchema([{ expected: 'migrate settings params', typeGuard: isMigrateSettingsParams }], SCHEMA_OPTIONS),
    output: createTypeGuardSchema({ ...SCHEMA_OPTIONS, expected: 'a migrate settings result', typeGuard: isMigrateSettingsResult })
  }
});

function getSettingPropertyNames(): (keyof HandedOverSettings)[] {
  // Every key of `SETTING_VALIDATORS` is a key of `HandedOverSettings`, by its mapped type.
  return Object.keys(SETTING_VALIDATORS) as (keyof HandedOverSettings)[];
}

function isEmptyFolderBehavior(value: unknown): value is EmptyFolderBehavior {
  return isString(value) && Object.hasOwn(EMPTY_FOLDER_BEHAVIORS, value);
}

function isHandedOverSettings(value: unknown): value is HandedOverSettings {
  return isObject(value) && getSettingPropertyNames().every((propertyName) => SETTING_VALIDATORS[propertyName](Reflect.get(value, propertyName)));
}

/**
 * Mirrors how the plugin reads a proposal: a member that is absent or `undefined` is not proposed, and a key that
 * names no setting is ignored rather than refused.
 *
 * @param value - The value to check.
 * @returns Whether the value is a proposal.
 */
function isMigratableSettings(value: unknown): value is MigratableSettings {
  return isObject(value) && getSettingPropertyNames().every((propertyName) => {
    const settingValue: unknown = Reflect.get(value, propertyName);
    return settingValue === undefined || SETTING_VALIDATORS[propertyName](settingValue);
  });
}

function isMigrateSettingsParams(value: unknown): value is MigrateSettingsParams {
  return isObject(value)
    && isString(Reflect.get(value, 'sourcePluginId'))
    && isMigratableSettings(Reflect.get(value, 'proposedSettings'));
}

function isMigrateSettingsResult(value: unknown): value is MigrateSettingsResult {
  return isObject(value) && isBoolean(Reflect.get(value, 'isApplied'));
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
