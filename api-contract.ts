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
 * Copying it takes two dependencies beside `api.d.ts` and `obsidian`. `@mnaoumov/typescript-lib` carries the
 * contract types, the {@link https://standardschema.dev | Standard Schema} builders and the guard builders, in
 * its `api-contract` and `type-guards` entry points. `@mnaoumov/obsidian-lib` carries the path-or-file guard, in
 * its `file-system` entry point. What is left here is this API's own constant and the guards for its own shapes.
 * The constant is typed as `TypedApiContract<BetterMarkdownLinksApi>`, which checks every entry against its
 * method's signature and requires both schemas on each.
 *
 * It is not named `api.ts`: TypeScript would read `api.d.ts` as that file's own declarations.
 */

import type { TypedApiContract } from '@mnaoumov/typescript-lib/api-contract';
import type {
  PropertyTypeGuards,
  TypeGuard
} from '@mnaoumov/typescript-lib/type-guards';

import { isPathOrFile } from '@mnaoumov/obsidian-lib/file-system';
import {
  createApiContractSchemaBuilders,
  createExpectedTypeGuard,
  defineApiContract,
  STRING_GUARD
} from '@mnaoumov/typescript-lib/api-contract';
import {
  isBoolean,
  isObject,
  isString,
  literalTypeGuard
} from '@mnaoumov/typescript-lib/type-guards';

import type {
  BetterMarkdownLinksApi,
  GenerateMarkdownLinkExtendedOptions,
  LinkPathStyle,
  LinkStyle
} from './api.d.ts';

/**
 * The type of {@link BETTER_MARKDOWN_LINKS_API_CONTRACT}: one entry per method of {@link BetterMarkdownLinksApi},
 * each typed against that method's parameters and awaited return value.
 */
export type BetterMarkdownLinksApiContract = TypedApiContract<BetterMarkdownLinksApi>;

const { createArgumentsSchema, createTypeGuardSchema } = createApiContractSchemaBuilders('better-markdown-links');

/**
 * The values of {@link LinkPathStyle}, spelled out because `api.d.ts` declares the enum without a runtime
 * object. Keyed by the enum's own values, so adding or dropping a member there refuses to compile here.
 */
const isLinkPathStyle = literalTypeGuard<LinkPathStyle>({
  AbsolutePathInVault: true,
  ObsidianSettingsDefault: true,
  RelativePathToTheSource: true,
  ShortestPathWhenPossible: true
});

/**
 * The values of {@link LinkStyle}, spelled out for the same reason as {@link isLinkPathStyle}.
 */
const isLinkStyle = literalTypeGuard<LinkStyle>({
  Markdown: true,
  ObsidianSettingsDefault: true,
  PreserveExisting: true,
  Wikilink: true
});

/**
 * One guard per key of {@link GenerateMarkdownLinkExtendedOptions}, so a new option refuses to compile until it
 * has one. A present key must match its declared type: `undefined` is not accepted for an optional key, which is
 * why these guards are not widened with `optionalTypeGuard` and are not handed to `objectTypeGuard`.
 */
const OPTION_GUARDS: PropertyTypeGuards<GenerateMarkdownLinkExtendedOptions> = {
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
export const BETTER_MARKDOWN_LINKS_API_CONTRACT: BetterMarkdownLinksApiContract = defineApiContract<BetterMarkdownLinksApi>({
  generateMarkdownLinkExtended: {
    input: createArgumentsSchema([
      createExpectedTypeGuard('the options of the link to generate, with a sourcePathOrFile and a targetPathOrFile', isGenerateMarkdownLinkExtendedOptions)
    ]),
    output: createTypeGuardSchema({ ...STRING_GUARD, expected: 'the markdown of a link' })
  }
});

/**
 * Kept local rather than built with `objectTypeGuard`, which reads every key with `Reflect.get`: that cannot tell
 * an absent optional key (accepted) from one present as `undefined` (refused), and it would let an inherited key
 * through. This guard reads only OWN keys, and refuses an array.
 *
 * @param value - The value to check.
 * @returns Whether the value is the options of a link to generate.
 */
function isGenerateMarkdownLinkExtendedOptions(value: unknown): value is GenerateMarkdownLinkExtendedOptions {
  if (!isObject(value) || Array.isArray(value)) {
    return false;
  }

  const optionGuards: Readonly<Record<string, TypeGuard<unknown>>> = OPTION_GUARDS;
  for (const [key, isOptionValue] of Object.entries(optionGuards)) {
    if (Object.hasOwn(value, key) ? !isOptionValue(Reflect.get(value, key)) : REQUIRED_OPTION_KEYS.has(key)) {
      return false;
    }
  }

  return true;
}
