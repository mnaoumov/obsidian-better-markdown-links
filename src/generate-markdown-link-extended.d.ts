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

export type GenerateMarkdownLinkExtendedFn = (options: GenerateMarkdownLinkExtendedOptions) => string;

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
  extended: GenerateMarkdownLinkExtendedFn;
}

export type PathOrFile = string | TFile;
