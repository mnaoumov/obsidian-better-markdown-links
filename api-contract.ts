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
import type { PropertyTypeGuards } from '@mnaoumov/typescript-lib/type-guards';

import { isPathOrFile } from '@mnaoumov/obsidian-lib/file-system';
import {
  createApiContractSchemaBuilders,
  createExpectedTypeGuard,
  defineApiContract,
  STRING_GUARD
} from '@mnaoumov/typescript-lib/api-contract';
import {
  isBoolean,
  isString,
  literalTypeGuard,
  objectTypeGuard
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
 * why these guards are not widened with `optionalTypeGuard`.
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

/**
 * Reads only OWN keys and holds every optional key to exact optional properties: an absent optional key is
 * accepted, one present as `undefined` is refused, and an inherited key counts as absent. Every optional key is
 * listed, so an option added to {@link GenerateMarkdownLinkExtendedOptions} refuses to compile until it is.
 */
const isGenerateMarkdownLinkExtendedOptions = objectTypeGuard<GenerateMarkdownLinkExtendedOptions>(OPTION_GUARDS, {
  exactOptionalKeys: {
    alias: true,
    isEmbed: true,
    isEmptyEmbedAliasAllowed: true,
    isNonExistingFileAllowed: true,
    isSingleSubpathAllowed: true,
    linkPathStyle: true,
    linkStyle: true,
    originalLink: true,
    shouldEscapeAlias: true,
    shouldIncludeAttachmentExtensionToEmbedAlias: true,
    shouldUseAngleBrackets: true,
    shouldUseLeadingDotForRelativePaths: true,
    shouldUseLeadingSlashForAbsolutePaths: true,
    subpath: true
  }
});

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
