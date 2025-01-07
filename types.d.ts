import type { TFile } from 'obsidian';

/**
 * Extended implementation of the `app.fileManager.generateMarkdownLink` function from Obsidian.
 *
 * Usage: `(app.fileManager.generateMarkdownLink as GenerateMarkdownLinkFn)(options)`
 */
type GenerateMarkdownLinkFn = (options: GenerateMarkdownLinkOptions) => string

/**
 * Options for generating a markdown link.
 */
interface GenerateMarkdownLinkOptions {
  /**
   * The file to link to.
   */
  pathOrFile: string | TFile;

  /**
   * The source path of the link.
   */
  sourcePathOrFile: string | TFile;

  /**
   * The subpath of the link.
   */
  subpath?: string | undefined;

  /**
   * The alias for the link.
   */
  alias?: string | undefined;

  /**
   * Indicates if the link should be embedded. If not provided, it will be inferred based on the file type.
   */
  isEmbed?: boolean | undefined;

  /**
   * Indicates if the link should be a wikilink. If not provided, it will be inferred based on the Obsidian settings.
   */
  isWikilink?: boolean | undefined;

  /**
   * Indicates if the link should be relative. If not provided or `false`, it will be inferred based on the Obsidian settings.
   */
  forceRelativePath?: boolean | undefined;

  /**
   * Indicates if the link should use a leading dot. Defaults to `false`. Has no effect if `isWikilink` is `true` or `isRelative` is `false`.
   */
  useLeadingDot?: boolean | undefined;

  /**
   * Indicates if the link should use angle brackets. Defaults to `false`. Has no effect if `isWikilink` is `true`
   */
  useAngleBrackets?: boolean | undefined;

  /**
    * The original link text. If provided, it will be used to infer the values of `isEmbed`, `isWikilink`, `useLeadingDot`, and `useAngleBrackets`.
    * These inferred values will be overridden by corresponding settings if specified.
    */
  originalLink?: string | undefined;

  /**
   * Whether to allow non-existing files. If `false` and `pathOrFile` is a non-existing file, an error will be thrown. Defaults to `false`.
   */
  allowNonExistingFile?: boolean | undefined;

  /**
   * Whether to allow an empty alias for embeds. Defaults to `true`.
   */
  allowEmptyEmbedAlias?: boolean | undefined;

  /**
   * Whether to include the attachment extension in the embed alias. Has no effect if `allowEmptyEmbedAlias` is `true`. Defaults to `false`.
   */
  includeAttachmentExtensionToEmbedAlias?: boolean | undefined;
}
