/**
 * @file
 *
 * Maps the published options of `api.d.ts` onto the library's `generateMarkdownLink` params.
 *
 * `api.d.ts` declares its own `LinkStyle` and `LinkPathStyle` enums, so a consumer copying it needs nothing but `obsidian`.
 * They carry the same values as the library's enums, but they are different enums, so each value is looked up here rather
 * than cast. The tables are keyed by the published values, so a member added to either published enum refuses to compile
 * until it is mapped.
 */

import type { GenerateMarkdownLinkParams } from '@mnaoumov/obsidian-lib/link';
import type { App } from 'obsidian';

import {
  LinkPathStyle as LibraryLinkPathStyle,
  LinkStyle as LibraryLinkStyle
} from '@mnaoumov/obsidian-lib/link';

import type {
  GenerateMarkdownLinkExtendedOptions,
  LinkPathStyle,
  LinkStyle
} from '../../api.d.ts';

/**
 * The published options type, re-spelled under the name the params-interface convention wants.
 */
type ToGenerateMarkdownLinkParamsOptions = GenerateMarkdownLinkExtendedOptions;

const LINK_PATH_STYLES: Readonly<Record<`${LinkPathStyle}`, LibraryLinkPathStyle>> = {
  AbsolutePathInVault: LibraryLinkPathStyle.AbsolutePathInVault,
  ObsidianSettingsDefault: LibraryLinkPathStyle.ObsidianSettingsDefault,
  RelativePathToTheSource: LibraryLinkPathStyle.RelativePathToTheSource,
  ShortestPathWhenPossible: LibraryLinkPathStyle.ShortestPathWhenPossible
};

const LINK_STYLES: Readonly<Record<`${LinkStyle}`, LibraryLinkStyle>> = {
  Markdown: LibraryLinkStyle.Markdown,
  ObsidianSettingsDefault: LibraryLinkStyle.ObsidianSettingsDefault,
  PreserveExisting: LibraryLinkStyle.PreserveExisting,
  Wikilink: LibraryLinkStyle.Wikilink
};

/**
 * Builds the library's `generateMarkdownLink` params from the published options.
 *
 * @param app - The Obsidian app instance.
 * @param options - The published options.
 * @returns The params, with each enum value translated to the library's enum.
 */
export function toGenerateMarkdownLinkParams(app: App, options: ToGenerateMarkdownLinkParamsOptions): GenerateMarkdownLinkParams {
  const {
    linkPathStyle,
    linkStyle,
    ...rest
  } = options;

  return {
    app,
    ...rest,
    ...(linkPathStyle !== undefined && { linkPathStyle: LINK_PATH_STYLES[linkPathStyle] }),
    ...(linkStyle !== undefined && { linkStyle: LINK_STYLES[linkStyle] })
  };
}
