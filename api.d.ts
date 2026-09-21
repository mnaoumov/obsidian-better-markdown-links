/**
 * The extended `app.fileManager.generateMarkdownLink()` overload this plugin installs.
 *
 * Copy this file into your own plugin: it imports from `obsidian` and nothing else, so it needs no dependency on this one. The
 * plugin widens a core Obsidian call rather than publishing an API, so there is no handle to fetch and nothing to negotiate — the
 * patch is installed or it is not:
 *
 * ```ts
 * const generate = app.fileManager.generateMarkdownLink as Partial<GenerateMarkdownLinkExtendedWrapper>;
 * const link = generate.extended?.({ sourcePathOrFile, targetPathOrFile, shouldUseAngleBrackets: true });
 * ```
 *
 * Versioning is therefore by plugin version alone. Every member below was added in **3.0.0**, the release that first shipped the
 * overload, and none has been added, renamed or removed since — so a consumer needs `better-markdown-links` 3.0.0 or later and
 * nothing finer-grained than that.
 */

import type { TFile } from 'obsidian';

export enum LinkPathStyle {
  AbsolutePathInVault = 'AbsolutePathInVault',

  ObsidianSettingsDefault = 'ObsidianSettingsDefault',

  RelativePathToTheSource = 'RelativePathToTheSource',

  ShortestPathWhenPossible = 'ShortestPathWhenPossible'
}

export enum LinkStyle {
  Markdown = 'Markdown',

  ObsidianSettingsDefault = 'ObsidianSettingsDefault',

  PreserveExisting = 'PreserveExisting',

  Wikilink = 'Wikilink'
}

export type GenerateMarkdownLinkExtendedFunction = (options: GenerateMarkdownLinkExtendedOptions) => string;

export interface GenerateMarkdownLinkExtendedOptions {
  readonly alias?: string;

  readonly isEmbed?: boolean;

  readonly isEmptyEmbedAliasAllowed?: boolean;

  readonly isNonExistingFileAllowed?: boolean;

  readonly isSingleSubpathAllowed?: boolean;

  readonly linkPathStyle?: LinkPathStyle;

  readonly linkStyle?: LinkStyle;

  readonly originalLink?: string;

  readonly shouldEscapeAlias?: boolean;

  readonly shouldIncludeAttachmentExtensionToEmbedAlias?: boolean;

  readonly shouldUseAngleBrackets?: boolean;

  readonly shouldUseLeadingDotForRelativePaths?: boolean;

  readonly shouldUseLeadingSlashForAbsolutePaths?: boolean;

  readonly sourcePathOrFile: PathOrFile;

  readonly subpath?: string;

  readonly targetPathOrFile: PathOrFile;
}

export interface GenerateMarkdownLinkExtendedWrapper {
  extended: GenerateMarkdownLinkExtendedFunction;
}

export type PathOrFile = string | TFile;
