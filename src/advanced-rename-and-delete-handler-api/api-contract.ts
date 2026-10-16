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
 * Copyable for the same reason `api.d.ts` is: it imports from `./api.d.ts` and nothing else. So the schemas are
 * hand-written {@link https://standardschema.dev | Standard Schema} objects rather than built with a schema
 * library, and the constant is typed structurally rather than as a registry type. A consumer on a library whose
 * contract type is generic over the API (such as `PluginApiContract<AdvancedRenameAndDeleteHandlerApi>`) can
 * assign the constant to it, which checks every entry against its method's signature.
 *
 * It is not named `api.ts`: TypeScript would read `api.d.ts` as that file's own declarations.
 */

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
export type AdvancedRenameAndDeleteHandlerApiContract = {
  readonly [TMethodName in keyof AdvancedRenameAndDeleteHandlerApi]: AdvancedRenameAndDeleteHandlerApiMethodContract<
    Parameters<AdvancedRenameAndDeleteHandlerApi[TMethodName]>,
    Awaited<ReturnType<AdvancedRenameAndDeleteHandlerApi[TMethodName]>>
  >;
};

/**
 * The payload schemas of one method.
 *
 * @typeParam TParameters - The method's parameters.
 * @typeParam TReturnValue - The method's return value, awaited.
 */
export interface AdvancedRenameAndDeleteHandlerApiMethodContract<TParameters, TReturnValue> {
  /**
   * Validates the method's arguments, as an array.
   */
  readonly input: AdvancedRenameAndDeleteHandlerApiSchema<TParameters>;

  /**
   * Validates the method's return value, or the value it resolves to.
   */
  readonly output: AdvancedRenameAndDeleteHandlerApiSchema<TReturnValue>;
}

/**
 * A {@link https://standardschema.dev | Standard Schema} (`StandardSchemaV1<unknown, T>`), restated with only the
 * members this file uses so it needs no dependency for them.
 *
 * @typeParam T - The type a value that passes is.
 */
export interface AdvancedRenameAndDeleteHandlerApiSchema<T> {
  /**
   * The Standard Schema properties.
   */
  readonly '~standard': AdvancedRenameAndDeleteHandlerApiSchemaProps<T>;
}

/**
 * The result of a value that failed {@link AdvancedRenameAndDeleteHandlerApiSchema}'s `validate`.
 */
export interface AdvancedRenameAndDeleteHandlerApiSchemaFailure {
  /**
   * What was wrong with the value.
   */
  readonly issues: readonly AdvancedRenameAndDeleteHandlerApiSchemaIssue[];
}

/**
 * One thing wrong with a value.
 */
export interface AdvancedRenameAndDeleteHandlerApiSchemaIssue {
  /**
   * What was expected.
   */
  readonly message: string;

  /**
   * Where in the value, e.g. `[0]` for the first argument; absent for the value as a whole.
   */
  readonly path?: readonly PropertyKey[];
}

/**
 * The Standard Schema properties of {@link AdvancedRenameAndDeleteHandlerApiSchema}.
 *
 * @typeParam T - The type a value that passes is.
 */
export interface AdvancedRenameAndDeleteHandlerApiSchemaProps<T> {
  /**
   * The inferred types, present for type inference only.
   */
  readonly types?: AdvancedRenameAndDeleteHandlerApiSchemaTypes<T> | undefined;

  /**
   * Validates a value.
   *
   * @param value - The value to validate.
   * @returns The value when it passes; otherwise the issues found.
   */
  readonly validate: (value: unknown) => AdvancedRenameAndDeleteHandlerApiSchemaResult<T>;

  /**
   * Who made the schema.
   */
  readonly vendor: string;

  /**
   * The Standard Schema version.
   */
  readonly version: 1;
}

/**
 * The result of {@link AdvancedRenameAndDeleteHandlerApiSchema}'s `validate`.
 *
 * @typeParam T - The type a value that passes is.
 */
export type AdvancedRenameAndDeleteHandlerApiSchemaResult<T> =
  | AdvancedRenameAndDeleteHandlerApiSchemaFailure
  | AdvancedRenameAndDeleteHandlerApiSchemaSuccess<T>;

/**
 * The result of a value that passed {@link AdvancedRenameAndDeleteHandlerApiSchema}'s `validate`.
 *
 * @typeParam T - The type a value that passes is.
 */
export interface AdvancedRenameAndDeleteHandlerApiSchemaSuccess<T> {
  /**
   * Absent on success.
   */
  readonly issues?: undefined;

  /**
   * The value.
   */
  readonly value: T;
}

/**
 * The types a schema infers, present for type inference only.
 *
 * @typeParam T - The type a value that passes is.
 */
export interface AdvancedRenameAndDeleteHandlerApiSchemaTypes<T> {
  /**
   * The type the schema accepts.
   */
  readonly input: unknown;

  /**
   * The type a value that passes is.
   */
  readonly output: T;
}

type ArgumentSchemaParams<TParameters extends readonly unknown[]> = {
  readonly [TIndex in keyof TParameters]: ValueSchemaParams<TParameters[TIndex]>;
};

type SettingValidators = {
  readonly [TPropertyName in keyof HandedOverSettings]-?: (value: unknown) => value is HandedOverSettings[TPropertyName];
};

interface ValueSchemaParams<T> {
  readonly expected: string;
  readonly isValid: (value: unknown) => value is T;
}

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

const PATH: ValueSchemaParams<string> = {
  expected: 'a path',
  isValid: isString
};

/**
 * The contract this plugin publishes with {@link AdvancedRenameAndDeleteHandlerApi}, for a consumer to pass as
 * the `contract` when it looks the API up.
 */
export const ADVANCED_RENAME_AND_DELETE_HANDLER_API_CONTRACT: AdvancedRenameAndDeleteHandlerApiContract = {
  getSettings: {
    input: createArgumentsSchema<[]>([]),
    output: createValueSchema({ expected: 'the handed-over settings', isValid: isHandedOverSettings })
  },
  isPathIgnored: {
    input: createArgumentsSchema<[path: string]>([PATH]),
    output: createValueSchema({ expected: 'a boolean', isValid: isBoolean })
  },
  isTreatedAsAttachment: {
    input: createArgumentsSchema<[path: string]>([PATH]),
    output: createValueSchema({ expected: 'a boolean', isValid: isBoolean })
  },
  migrateSettings: {
    input: createArgumentsSchema<[params: MigrateSettingsParams]>([{ expected: 'migrate settings params', isValid: isMigrateSettingsParams }]),
    output: createValueSchema({ expected: 'a migrate settings result', isValid: isMigrateSettingsResult })
  }
};

function createArgumentsSchema<TParameters extends readonly unknown[]>(
  parameters: ArgumentSchemaParams<TParameters>
): AdvancedRenameAndDeleteHandlerApiSchema<TParameters> {
  const parameterList: readonly ValueSchemaParams<unknown>[] = parameters;

  function getIssues(value: unknown): AdvancedRenameAndDeleteHandlerApiSchemaIssue[] {
    if (!Array.isArray(value)) {
      return [{ message: 'Expected an argument list.' }];
    }

    return value.length > parameterList.length
      ? [{ message: `Expected at most ${String(parameterList.length)} argument(s), got ${String(value.length)}.` }]
      : parameterList.flatMap((parameter, index) => parameter.isValid(value[index]) ? [] : [{ message: `Expected ${parameter.expected}.`, path: [index] }]);
  }

  function isArgumentList(value: unknown): value is TParameters {
    return getIssues(value).length === 0;
  }

  return createSchema((value) => isArgumentList(value) ? { value } : { issues: getIssues(value) });
}

function createSchema<T>(
  validate: (value: unknown) => AdvancedRenameAndDeleteHandlerApiSchemaResult<T>
): AdvancedRenameAndDeleteHandlerApiSchema<T> {
  return {
    '~standard': {
      validate,
      vendor: VENDOR,
      version: 1
    }
  };
}

function createValueSchema<T>(params: ValueSchemaParams<T>): AdvancedRenameAndDeleteHandlerApiSchema<T> {
  return createSchema((value) => params.isValid(value) ? { value } : { issues: [{ message: `Expected ${params.expected}.` }] });
}

function getSettingPropertyNames(): (keyof HandedOverSettings)[] {
  // Every key of `SETTING_VALIDATORS` is a key of `HandedOverSettings`, by its mapped type.
  return Object.keys(SETTING_VALIDATORS) as (keyof HandedOverSettings)[];
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isEmptyFolderBehavior(value: unknown): value is EmptyFolderBehavior {
  return typeof value === 'string' && Object.hasOwn(EMPTY_FOLDER_BEHAVIORS, value);
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
    && typeof Reflect.get(value, 'sourcePluginId') === 'string'
    && isMigratableSettings(Reflect.get(value, 'proposedSettings'));
}

function isMigrateSettingsResult(value: unknown): value is MigrateSettingsResult {
  return isObject(value) && isBoolean(Reflect.get(value, 'isApplied'));
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isString(item));
}
