/**
 * @file
 *
 * The runtime half of `Better Markdown Links`' published API: its CONTRACT, one entry per method of
 * {@link BetterMarkdownLinksApi}, each with a schema over the argument list and a schema over the value the method
 * returns.
 *
 * This plugin publishes exactly this constant with its API, and a consumer copies it beside `api.d.ts` and
 * passes it as the `contract` when it looks the API up, so both ends validate against ONE definition. The
 * plugin registry checks the payloads against it only while its debugger is on.
 *
 * Copyable for the same reason `api.d.ts` is: it imports from `obsidian` and `./api.d.ts` and nothing else. So
 * the schemas are hand-written {@link https://standardschema.dev | Standard Schema} objects rather than built with
 * a schema library, and the constant is typed structurally rather than as a registry type. A consumer on a
 * library whose contract type is generic over the API (such as `PluginApiContract<BetterMarkdownLinksApi>`) can
 * assign the constant to it, which checks every entry against its method's signature.
 *
 * It is not named `api.ts`: TypeScript would read `api.d.ts` as that file's own declarations.
 */

import { TFile } from 'obsidian';

import type {
  BetterMarkdownLinksApi,
  GenerateMarkdownLinkExtendedOptions,
  LinkPathStyle,
  LinkStyle,
  PathOrFile
} from './api.d.ts';

/**
 * The type of {@link BETTER_MARKDOWN_LINKS_API_CONTRACT}: one entry per method of {@link BetterMarkdownLinksApi},
 * each typed against that method's parameters and awaited return value.
 */
export type BetterMarkdownLinksApiContract = {
  readonly [TMethodName in keyof BetterMarkdownLinksApi]: BetterMarkdownLinksApiMethodContract<
    Parameters<BetterMarkdownLinksApi[TMethodName]>,
    Awaited<ReturnType<BetterMarkdownLinksApi[TMethodName]>>
  >;
};

/**
 * The payload schemas of one method.
 *
 * @typeParam TParameters - The method's parameters.
 * @typeParam TReturnValue - The method's return value, awaited.
 */
export interface BetterMarkdownLinksApiMethodContract<TParameters, TReturnValue> {
  /**
   * Validates the method's arguments, as an array.
   */
  readonly input: BetterMarkdownLinksApiSchema<TParameters>;

  /**
   * Validates the method's return value, or the value it resolves to.
   */
  readonly output: BetterMarkdownLinksApiSchema<TReturnValue>;
}

/**
 * A {@link https://standardschema.dev | Standard Schema} (`StandardSchemaV1<unknown, T>`), restated with
 * only the members this file uses so it needs no dependency for them.
 *
 * @typeParam T - The type a value that passes is.
 */
export interface BetterMarkdownLinksApiSchema<T> {
  /**
   * The Standard Schema properties.
   */
  readonly '~standard': BetterMarkdownLinksApiSchemaProps<T>;
}

/**
 * The result of a value that failed {@link BetterMarkdownLinksApiSchema}'s `validate`.
 */
export interface BetterMarkdownLinksApiSchemaFailure {
  /**
   * What was wrong with the value.
   */
  readonly issues: readonly BetterMarkdownLinksApiSchemaIssue[];
}

/**
 * One thing wrong with a value.
 */
export interface BetterMarkdownLinksApiSchemaIssue {
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
 * The Standard Schema properties of {@link BetterMarkdownLinksApiSchema}.
 *
 * @typeParam T - The type a value that passes is.
 */
export interface BetterMarkdownLinksApiSchemaProps<T> {
  /**
   * The inferred types, present for type inference only.
   */
  readonly types?: BetterMarkdownLinksApiSchemaTypes<T> | undefined;

  /**
   * Validates a value.
   *
   * @param value - The value to validate.
   * @returns The value when it passes; otherwise the issues found.
   */
  readonly validate: (value: unknown) => BetterMarkdownLinksApiSchemaResult<T>;

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
 * The result of {@link BetterMarkdownLinksApiSchema}'s `validate`.
 *
 * @typeParam T - The type a value that passes is.
 */
export type BetterMarkdownLinksApiSchemaResult<T> = BetterMarkdownLinksApiSchemaFailure | BetterMarkdownLinksApiSchemaSuccess<T>;

/**
 * The result of a value that passed {@link BetterMarkdownLinksApiSchema}'s `validate`.
 *
 * @typeParam T - The type a value that passes is.
 */
export interface BetterMarkdownLinksApiSchemaSuccess<T> {
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
export interface BetterMarkdownLinksApiSchemaTypes<T> {
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

type OptionValidators = Readonly<Record<keyof GenerateMarkdownLinkExtendedOptions, (value: unknown) => boolean>>;

interface ValueSchemaParams<T> {
  readonly expected: string;
  readonly isValid: (value: unknown) => value is T;
}

const VENDOR = 'better-markdown-links';

/**
 * The values of {@link LinkPathStyle}, spelled out because `api.d.ts` declares the enum without a runtime
 * object. Keyed by the enum's own values, so adding or dropping a member there refuses to compile here.
 */
const LINK_PATH_STYLES: Readonly<Record<`${LinkPathStyle}`, true>> = {
  AbsolutePathInVault: true,
  ObsidianSettingsDefault: true,
  RelativePathToTheSource: true,
  ShortestPathWhenPossible: true
};

/**
 * The values of {@link LinkStyle}, spelled out for the same reason as {@link LINK_PATH_STYLES}.
 */
const LINK_STYLES: Readonly<Record<`${LinkStyle}`, true>> = {
  Markdown: true,
  ObsidianSettingsDefault: true,
  PreserveExisting: true,
  Wikilink: true
};

/**
 * One check per key of {@link GenerateMarkdownLinkExtendedOptions}, so a new option refuses to compile until it
 * has one. A present key must match its declared type: `undefined` is not accepted for an optional key.
 */
const OPTION_VALIDATORS: OptionValidators = {
  alias: isString,
  isEmbed: isBoolean,
  isEmptyEmbedAliasAllowed: isBoolean,
  isNonExistingFileAllowed: isBoolean,
  isSingleSubpathAllowed: isBoolean,
  linkPathStyle: isLinkPathStyle,
  linkStyle: isLinkStyle,
  originalLink: isString,
  shouldEscapeAlias: isBoolean,
  shouldIncludeAttachmentExtensionToEmbedAlias: isBoolean,
  shouldUseAngleBrackets: isBoolean,
  shouldUseLeadingDotForRelativePaths: isBoolean,
  shouldUseLeadingSlashForAbsolutePaths: isBoolean,
  sourcePathOrFile: isPathOrFile,
  subpath: isString,
  targetPathOrFile: isPathOrFile
};

const REQUIRED_OPTION_KEYS: ReadonlySet<string> = new Set<keyof GenerateMarkdownLinkExtendedOptions>(['sourcePathOrFile', 'targetPathOrFile']);

/**
 * The contract this plugin publishes with {@link BetterMarkdownLinksApi}, for a consumer to pass as the
 * `contract` when it looks the API up.
 */
export const BETTER_MARKDOWN_LINKS_API_CONTRACT: BetterMarkdownLinksApiContract = {
  generateMarkdownLinkExtended: {
    input: createArgumentsSchema<[options: GenerateMarkdownLinkExtendedOptions]>([{
      expected: 'the options of the link to generate, with a sourcePathOrFile and a targetPathOrFile',
      isValid: isGenerateMarkdownLinkExtendedOptions
    }]),
    output: createValueSchema({ expected: 'the markdown of a link', isValid: isString })
  }
};

function createArgumentsSchema<TParameters extends readonly unknown[]>(
  parameters: ArgumentSchemaParams<TParameters>
): BetterMarkdownLinksApiSchema<TParameters> {
  const parameterList: readonly ValueSchemaParams<unknown>[] = parameters;

  function getIssues(value: unknown): BetterMarkdownLinksApiSchemaIssue[] {
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

function createSchema<T>(validate: (value: unknown) => BetterMarkdownLinksApiSchemaResult<T>): BetterMarkdownLinksApiSchema<T> {
  return {
    '~standard': {
      validate,
      vendor: VENDOR,
      version: 1
    }
  };
}

function createValueSchema<T>(params: ValueSchemaParams<T>): BetterMarkdownLinksApiSchema<T> {
  return createSchema((value) => params.isValid(value) ? { value } : { issues: [{ message: `Expected ${params.expected}.` }] });
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isGenerateMarkdownLinkExtendedOptions(value: unknown): value is GenerateMarkdownLinkExtendedOptions {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const options = value as Record<string, unknown>;
  return Object.keys(OPTION_VALIDATORS).filter(isOptionKey).every((key) => Object.hasOwn(options, key) ? OPTION_VALIDATORS[key](options[key]) : !REQUIRED_OPTION_KEYS.has(key));
}

function isLinkPathStyle(value: unknown): value is LinkPathStyle {
  return isString(value) && Object.hasOwn(LINK_PATH_STYLES, value);
}

function isLinkStyle(value: unknown): value is LinkStyle {
  return isString(value) && Object.hasOwn(LINK_STYLES, value);
}

function isOptionKey(key: string): key is keyof OptionValidators {
  return Object.hasOwn(OPTION_VALIDATORS, key);
}

function isPathOrFile(value: unknown): value is PathOrFile {
  return isString(value) || value instanceof TFile;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
