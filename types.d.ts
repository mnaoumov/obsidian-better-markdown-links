import type { TFile } from 'obsidian';

/**
 * Extended implementation of the `app.fileManager.generateMarkdownLink` function from Obsidian.
 *
 * Usage: `(app.fileManager.generateMarkdownLink as GenerateMarkdownLinkFn)(options)`
 */
type GenerateMarkdownLinkFn = (options: GenerateMarkdownLinkOptions) => string;

/**
 * Represents a path or a file.
 */
export type PathOrFile = string | TFile;

/**
 * Options for generating a markdown link.
 */
export interface GenerateMarkdownLinkOptions {
  /**
   * The alias for the link.
   */
  alias?: string;

  /**
   * Indicates if the link should be embedded. If not provided, it will be inferred based on the file type.
   */
  isEmbed?: boolean;

  /**
   * Whether to allow an empty alias for embeds. Defaults to `true`.
   */
  isEmptyEmbedAliasAllowed?: boolean;

  /**
   * Whether to allow non-existing files. If `false` and `pathOrFile` is a non-existing file, an error will be thrown. Defaults to `false`.
   */
  isNonExistingFileAllowed?: boolean;

  /**
   * Indicates if the link should be a wikilink. If not provided, it will be inferred based on the Obsidian settings.
   */
  isWikilink?: boolean;

  /**
    * The original link text. If provided, it will be used to infer the values of `isEmbed`, `isWikilink`, `useLeadingDot`, and `useAngleBrackets`.
    * These inferred values will be overridden by corresponding settings if specified.
    */
  originalLink?: string;

  /**
   * Indicates if the link should be relative. If not provided or `false`, it will be inferred based on the Obsidian settings.
   */
  shouldForceRelativePath?: boolean;

  /**
   * Whether to include the attachment extension in the embed alias. Has no effect if `allowEmptyEmbedAlias` is `true`. Defaults to `false`.
   */
  shouldIncludeAttachmentExtensionToEmbedAlias?: boolean;

  /**
   * Indicates if the link should use angle brackets. Defaults to `false`. Has no effect if `isWikilink` is `true`
   */
  shouldUseAngleBrackets?: boolean;

  /**
   * Indicates if the link should use a leading dot. Defaults to `false`. Has no effect if `isWikilink` is `true` or `isRelative` is `false`.
   */
  shouldUseLeadingDot?: boolean;

  /**
   * The source path of the link.
   */
  sourcePathOrFile: PathOrFile;

  /**
   * The subpath of the link.
   */
  subpath?: string;

  /**
   * The target path or file.
   */
  targetPathOrFile: PathOrFile;
}
