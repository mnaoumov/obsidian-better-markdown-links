import type { Reference } from 'obsidian';

import {
  hasWikilinkSyntax,
  LinkStyle
} from '@mnaoumov/obsidian-lib/link';
import { isCanvasReference } from '@mnaoumov/obsidian-lib/reference';
import { isFrontmatterLinkCache } from '@obsidian-typings/obsidian-public-latest/implementations';

/**
 * Params for {@link getLinkStyleForReference}.
 *
 * @typeParam TLinkStyle - The run's style: `null` only where the run leaves the style to the inference.
 */
export interface GetLinkStyleForReferenceParams<TLinkStyle extends LinkStyle | null = LinkStyle | null> {
  /**
   * The style the run would write, or `null` for `@mnaoumov/obsidian-lib`' own inference.
   */
  readonly linkStyle: TLinkStyle;

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
 * A wikilink in a note's frontmatter keeps the wikilink style unless the setting says otherwise. Since
 * Obsidian 1.11 a markdown link in a property is indexed, rendered and renamed like a wikilink, but Bases
 * still reads it as text rather than a link value, so a filter comparing the property with a link (such as
 * `related == link("Note")`) drops a converted note from its table. Its path style is still converted,
 * since that keeps it a wikilink. A canvas reference is frontmatter-shaped without being frontmatter, so it
 * keeps the run's style.
 *
 * Every surface that rewrites an existing reference goes through this — the converter, the
 * automatic-conversion probe and the embed demoter — so they cannot disagree.
 *
 * @typeParam TLinkStyle - The run's style, so a run with a style always gets one back.
 * @param params - See {@link GetLinkStyleForReferenceParams}.
 * @returns The style to write for this reference, or `null` to leave it to `@mnaoumov/obsidian-lib`' own inference.
 */
export function getLinkStyleForReference<TLinkStyle extends LinkStyle | null>(
  params: GetLinkStyleForReferenceParams<TLinkStyle>
): LinkStyle | TLinkStyle {
  const { linkStyle, reference } = params;
  if (params.shouldConvertFrontmatterWikilinksToMarkdown || !isFrontmatterLinkCache(reference) || isCanvasReference(reference)) {
    return linkStyle;
  }

  return hasWikilinkSyntax(reference.original) ? LinkStyle.Wikilink : linkStyle;
}
