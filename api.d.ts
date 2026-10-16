/**
 * @file
 *
 * This plugin's whole public surface, as a consumer sees it.
 *
 * Hand-written and self-contained on purpose: it imports from `obsidian` and nothing else, so a plugin that has never heard of
 * `@mnaoumov/obsidian-lib` can copy this file into its own source and depend on this plugin with no build-time dependency on this
 * repository at all.
 *
 * {@link BetterMarkdownLinksApi} is published through the `@mnaoumov/obsidian-lib` plugin registry under the plugin id
 * `better-markdown-links`, at contract version **1.0.0**. A consumer built on `@mnaoumov/obsidian-lib` watches it:
 *
 * ```ts
 * const ref = watchPluginApi<BetterMarkdownLinksApi>({
 *   apiVersionRange: '^1',
 *   app: this.app,
 *   component: this,
 *   pluginId: 'better-markdown-links'
 * });
 *
 * const link = ref.value?.generateMarkdownLinkExtended({ sourcePathOrFile, targetPathOrFile, shouldUseAngleBrackets: true })
 *   ?? this.app.fileManager.generateMarkdownLink(targetFile, sourcePath);
 * ```
 *
 * The contract version is independent of the plugin version: a consumer asks for `'^1'` and keeps working across every plugin
 * release that changes nothing it depends on.
 *
 * ## What it replaced
 *
 * Before **6.0.0** the same function was hung off Obsidian's own call, as `app.fileManager.generateMarkdownLink.extended`. That
 * member is gone. {@link BetterMarkdownLinksApi.generateMarkdownLinkExtended} takes exactly the options it took, so only the lookup
 * changes. `app.fileManager.generateMarkdownLink()` itself is still patched while this plugin is enabled, and still keeps its
 * built-in signature.
 */

import type { TFile } from 'obsidian';

/**
 * This plugin's API, published through the `@mnaoumov/obsidian-lib` plugin registry under the plugin id `better-markdown-links`.
 */
export interface BetterMarkdownLinksApi {
  /**
   * Generates a link the way this plugin generates links, with the full set of options it uses.
   *
   * An option left out falls back to this plugin's settings, and then to Obsidian's own, exactly as for a link the plugin writes
   * itself.
   *
   * @param options - The link to generate.
   * @returns The link's markdown.
   */
  generateMarkdownLinkExtended(options: GenerateMarkdownLinkExtendedOptions): string;
}

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

export type PathOrFile = string | TFile;
