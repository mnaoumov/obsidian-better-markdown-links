/**
 * @packageDocumentation
 *
 * A set of types helpers to use the extended implementation of the {@link FileManager.generateMarkdownLink} function from Obsidian.
 *
 * @example
 * ```ts
 * (app.fileManager.generateMarkdownLink as GenerateMarkdownLinkExtendedWrapper).extended(options)
 * ```
 */

import type {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used in tsdoc.
  FileManager,
  TFile
} from 'obsidian';

/**
 * A style of the link path.
 */
export enum LinkPathStyle {
  /**
   * Use the absolute path in the vault.
   *
   * @example `[[path/from/the/vault/root/target]]`
   */
  AbsolutePathInVault = 'AbsolutePathInVault',

  /**
   * Use the default link path style defined in Obsidian settings.
   */
  ObsidianSettingsDefault = 'ObsidianSettingsDefault',

  /**
   * Use the relative path to the source.
   *
   * @example `[[../../relative/path/to/target]]`
   */
  RelativePathToTheSource = 'RelativePathToTheSource',

  /**
   * Use the shortest path when possible.
   *
   * @example `[[shortest-path-to-target]]`
   */
  ShortestPathWhenPossible = 'ShortestPathWhenPossible'
}

/**
 * A style of the link.
 */
export enum LinkStyle {
  /**
   * Force the link to be in markdown format.
   *
   * @example `[alias](path/to/target.md)`
   */
  Markdown = 'Markdown',

  /**
   * Use the default link style defined in Obsidian settings.
   */
  ObsidianSettingsDefault = 'ObsidianSettingsDefault',

  /**
   * Preserve the existing link style.
   */
  PreserveExisting = 'PreserveExisting',

  /**
   * Force the link to be in wikilink format.
   *
   * @example `[[path/to/target]]`
   * @example `[[path/to/target|alias]]`
   */
  Wikilink = 'Wikilink'
}

/**
 * Extended implementation of the {@link FileManager.generateMarkdownLink} function from Obsidian.
 *
 * @param options - Extended options.
 * @returns A generated markdown link.
 */
export type GenerateMarkdownLinkExtendedFn = (options: GenerateMarkdownLinkExtendedOptions) => string;

/**
 * Extended options for {@link FileManager.generateMarkdownLink}.
 */
export interface GenerateMarkdownLinkExtendedOptions {
  /**
   * An alias for the link.
   *
   * @example `[[alias|link]]`
   * @example `[alias](link.md)`
   */
  alias?: string;

  /**
   * Indicates if the link should be embedded. If not provided, it will be inferred based on the file type.
   *
   * If `true`: `![[target]]`.
   *
   * If `false`: `[[target]]`.
   */
  isEmbed?: boolean;

  /**
   * Whether to allow an empty alias for embeds. Defaults to `true`.
   *
   * Applicable only if the result link style is {@link LinkStyle.Markdown}.
   *
   * If `true`: `![](foo.png)`.
   *
   * If `false`: `![foo](foo.png)`.
   */
  isEmptyEmbedAliasAllowed?: boolean;

  /**
   * Whether to allow non-existing files. Defaults to `false`.
   *
   * If `false` and {@link targetPathOrFile} is a non-existing file, an error will be thrown.
   */
  isNonExistingFileAllowed?: boolean;

  /**
   * Whether to allow a single subpath. Defaults to `true`.
   *
   * Applicable only if {@link targetPathOrFile} and {@link sourcePathOrFile} are the same file.
   *
   * If `true`: `[[#subpath]]`.
   *
   * If `false`: `[[source#subpath]]`
   */
  isSingleSubpathAllowed?: boolean;

  /**
   * A style of the link path.
   */
  linkPathStyle?: LinkPathStyle;

  /**
   * A style of the link.
   */
  linkStyle?: LinkStyle;

  /**
   * An original link text.
   *
   * If provided, it will be used to infer the values of
   *
   * - {@link isEmbed}
   * - {@link linkStyle}
   * - {@link shouldUseAngleBrackets}
   * - {@link shouldUseLeadingDotForRelativePaths}
   * - {@link shouldUseLeadingSlashForAbsolutePaths}
   *
   * These inferred values will be overridden by corresponding settings if specified.
   */
  originalLink?: string;

  /**
   * Whether to escape the alias. Defaults to `false`.
   *
   * Applicable only if the result link style is {@link LinkStyle.Markdown}.
   *
   * If `true`: `[\*\*alias\*\*](link.md)`.
   *
   * If `false`: `[**alias**](link.md)`.
   */
  shouldEscapeAlias?: boolean;

  /**
   * Whether to include the attachment extension in the embed alias. Defaults to `false`.
   *
   * Applicable only if {@link isEmptyEmbedAliasAllowed} is `false`.
   *
   * If `true`: `[foo.png](foo.png)`.
   *
   * If `false`: `[foo](foo.png)`.
   */
  shouldIncludeAttachmentExtensionToEmbedAlias?: boolean;

  /**
   * Indicates if the link should use angle brackets. Defaults to `false`.
   *
   * Applicable only if {@link linkStyle} is {@link LinkStyle.Markdown}.
   *
   * If `true`: `[alias](<path with spaces.md>)`.
   *
   * If `false`: `[alias](path%20with%20spaces.md)`.
   */
  shouldUseAngleBrackets?: boolean;

  /**
   * Indicates if the link should use a leading dot. Defaults to `false`.
   *
   * Applicable only if {@link linkPathStyle} is {@link LinkPathStyle.RelativePathToSource}.
   *
   * If `true`: `[[./relative/path/to/target]]`
   *
   * If `false`: `[[relative/path/to/target]]`
   */
  shouldUseLeadingDotForRelativePaths?: boolean;

  /**
   * Indicates if the link should use a leading slash. Defaults to `false`.
   *
   * Applicable only if {@link linkPathStyle} is {@link LinkPathStyle.AbsolutePathInVault}.
   *
   * If `true`: `[[/absolute/path/to/target]]`
   *
   * If `false`: `[[absolute/path/to/target]]`
   */
  shouldUseLeadingSlashForAbsolutePaths?: boolean;

  /**
   * A source path of the link.
   */
  sourcePathOrFile: PathOrFile;

  /**
   * A subpath of the link.
   *
   * Should be empty or start with `#`.
   *
   * @example `[[link-with-empty-subpath]]`
   * @example `[[link-with-subpath#subpath]]`
   * @example `[[link-with-subpath#subpath#nested-subpath]]`
   */
  subpath?: string;

  /**
   * A target path or file.
   */
  targetPathOrFile: PathOrFile;
}

export interface GenerateMarkdownLinkExtendedWrapper {
  extended: GenerateMarkdownLinkExtendedFn;
}

/**
 * Represents a path or a file.
 */
export type PathOrFile = string | TFile;
