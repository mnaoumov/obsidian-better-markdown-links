import type { GenerateRawMarkdownLinkParams } from '@mnaoumov/obsidian-lib/link';
import type {
  App,
  TFile
} from 'obsidian';

import { generateRawMarkdownLink } from '@mnaoumov/obsidian-lib/link';
import { parseLink } from '@mnaoumov/obsidian-lib/parse-link';
import { normalizeOptionalProperties } from '@mnaoumov/typescript-lib/object-utils';

import { translateObsidianSubpathToGitHubAnchor } from './github-heading-slug.ts';

/**
 * Params for {@link toGitHubHeadingAnchorLink}.
 */
export interface ToGitHubHeadingAnchorLinkParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The link, as written in the note.
   */
  readonly linkText: string;

  /**
   * The note the link leads to, or `null` if it leads nowhere.
   */
  readonly targetFile: null | TFile;
}

/**
 * Rewrites a markdown link's heading subpath as the GitHub anchor of that heading:
 * `[x](<note.md#My Heading>)` becomes `[x](<note.md#my-heading>)`.
 *
 * Everything else is left exactly as written: a wikilink (GitHub does not render one, so its anchor would buy
 * nothing and Obsidian's own form keeps working without this plugin), an external link, a link with no subpath,
 * a block or footnote subpath, a link into anything but a note, and a subpath that names no heading — which
 * includes one that is already an anchor, so applying this twice changes nothing more.
 *
 * Every surface that writes links goes through this — the `generateMarkdownLink` patch, the converter and the
 * automatic-conversion probe — so they cannot disagree.
 *
 * @param params - See {@link ToGitHubHeadingAnchorLinkParams}.
 * @returns The rewritten link, or {@link ToGitHubHeadingAnchorLinkParams.linkText} unchanged.
 */
export function toGitHubHeadingAnchorLink(params: ToGitHubHeadingAnchorLinkParams): string {
  const { app, linkText, targetFile } = params;
  const parseLinkResult = parseLink(linkText);
  if (!parseLinkResult || parseLinkResult.isWikilink || parseLinkResult.isExternal || targetFile?.extension !== 'md') {
    return linkText;
  }

  const subpathStart = parseLinkResult.url.indexOf('#');
  if (subpathStart === -1) {
    return linkText;
  }

  const headings = app.metadataCache.getFileCache(targetFile)?.headings ?? [];
  const anchor = translateObsidianSubpathToGitHubAnchor(headings, parseLinkResult.url.slice(subpathStart));
  if (anchor === null) {
    return linkText;
  }

  return generateRawMarkdownLink(normalizeOptionalProperties<GenerateRawMarkdownLinkParams>({
    alias: parseLinkResult.alias,
    isEmbed: parseLinkResult.isEmbed,
    isWikilink: false,
    shouldUseAngleBrackets: parseLinkResult.hasAngleBrackets === true,
    title: parseLinkResult.title,
    url: parseLinkResult.url.slice(0, subpathStart) + anchor
  }));
}
