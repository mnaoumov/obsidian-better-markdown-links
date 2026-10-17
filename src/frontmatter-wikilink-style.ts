import type { Reference } from 'obsidian';

import {
  hasWikilinkSyntax,
  LinkStyle
} from '@mnaoumov/obsidian-lib/link';
import { isCanvasReference } from '@mnaoumov/obsidian-lib/reference';
import { isFrontmatterLinkCache } from '@obsidian-typings/obsidian-public-latest/implementations';

/**
 * Params for {@link getLinkStyleForReference}.
 */
export interface GetLinkStyleForReferenceParams {
  /**
   * The style the run would write, or `undefined` for `@mnaoumov/obsidian-lib`' own inference.
   */
  readonly linkStyle: LinkStyle | undefined;

  /**
   * The reference about to be rewritten.
   */
  readonly reference: Reference;

  /**
   * The `shouldConvertFrontmatterWikilinksToMarkdown` setting.
   */
  readonly shouldConvertFrontmatterWikilinksToMarkdown: boolean;
}

/**
 * The style to write for one particular reference, given the style the run would otherwise write.
 *
 * A wikilink in a note's frontmatter keeps the wikilink style unless the setting says otherwise, because
 * Obsidian reads a link in a property only when it is a wikilink: a markdown link written in its place is a
 * plain string to Obsidian, so the property stops linking anywhere (a Bases item whose `base` property was
 * converted drops out of its table). Its path style is still converted, since that keeps it a wikilink. A
 * canvas reference is frontmatter-shaped without being frontmatter, so it keeps the run's style.
 *
 * Every surface that rewrites an existing reference goes through this — the converter, the
 * automatic-conversion probe and the embed demoter — so they cannot disagree.
 *
 * @param params - See {@link GetLinkStyleForReferenceParams}.
 * @returns The style to write for this reference.
 */
export function getLinkStyleForReference(params: GetLinkStyleForReferenceParams): LinkStyle | undefined {
  const { linkStyle, reference } = params;
  if (params.shouldConvertFrontmatterWikilinksToMarkdown || !isFrontmatterLinkCache(reference) || isCanvasReference(reference)) {
    return linkStyle;
  }

  return hasWikilinkSyntax(reference.original) ? LinkStyle.Wikilink : linkStyle;
}
