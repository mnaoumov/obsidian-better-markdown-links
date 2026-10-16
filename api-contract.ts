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
 * Copyable: it imports from `obsidian`, `./api.d.ts` and `@mnaoumov/typescript-lib`, which carries the generic
 * half — the contract types, the {@link https://standardschema.dev | Standard Schema} builders and the common
 * guards. So a consumer copying it needs that package; what is left here is this API's own constant and the
 * guards for its own shapes. The constant is typed as `TypedApiContract<BetterMarkdownLinksApi>`, which checks
 * every entry against its method's signature and requires both schemas on each.
 *
 * It is not named `api.ts`: TypeScript would read `api.d.ts` as that file's own declarations.
 */

import type { TypedApiContract } from '@mnaoumov/typescript-lib/api-contract';

import {
  createArgumentsSchema,
  createTypeGuardSchema,
  defineApiContract,
  STRING_GUARD
} from '@mnaoumov/typescript-lib/api-contract';
import {
  isBoolean,
  isString
} from '@mnaoumov/typescript-lib/type-guards';
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
export type BetterMarkdownLinksApiContract = TypedApiContract<BetterMarkdownLinksApi>;

type OptionValidators = Readonly<Record<keyof GenerateMarkdownLinkExtendedOptions, (value: unknown) => boolean>>;

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

const SCHEMA_OPTIONS = { vendor: VENDOR };

/**
 * The contract this plugin publishes with {@link BetterMarkdownLinksApi}, for a consumer to pass as the
 * `contract` when it looks the API up.
 */
export const BETTER_MARKDOWN_LINKS_API_CONTRACT: BetterMarkdownLinksApiContract = defineApiContract<BetterMarkdownLinksApi>({
  generateMarkdownLinkExtended: {
    input: createArgumentsSchema([{
      expected: 'the options of the link to generate, with a sourcePathOrFile and a targetPathOrFile',
      typeGuard: isGenerateMarkdownLinkExtendedOptions
    }], SCHEMA_OPTIONS),
    output: createTypeGuardSchema({ ...SCHEMA_OPTIONS, ...STRING_GUARD, expected: 'the markdown of a link' })
  }
});

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
