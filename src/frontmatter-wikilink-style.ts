import type {
  ConvertLinkParams,
  EditLinksParams,
  UpdateLinksInFileParams
} from '@mnaoumov/obsidian-lib/link';
import type { Reference } from 'obsidian';

import { isCanvasFile } from '@mnaoumov/obsidian-lib/file-system';
import {
  convertLink,
  editLinks,
  hasEmbedSyntax,
  hasWikilinkSyntax,
  LinkStyle
} from '@mnaoumov/obsidian-lib/link';
import { isCanvasReference } from '@mnaoumov/obsidian-lib/reference';
import { normalizeOptionalProperties } from '@mnaoumov/typescript-lib/object-utils';
import {
  InternalPluginName,
  isFrontmatterLinkCache
} from '@obsidian-typings/obsidian-public-latest/implementations';

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
 * Params for {@link updateLinksInFileKeepingFrontmatterWikilinks}.
 */
export interface UpdateLinksInFileKeepingFrontmatterWikilinksParams extends UpdateLinksInFileParams {
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

/**
 * `@mnaoumov/obsidian-lib`' `updateLinksInFile`, with the style decided per reference by
 * {@link getLinkStyleForReference} instead of once for the whole file.
 *
 * It is that function's own body over `editLinks` and `convertLink`, canvas guard and embed-only filter
 * included, because the library offers no per-reference style.
 *
 * @param params - See {@link UpdateLinksInFileKeepingFrontmatterWikilinksParams}.
 */
export async function updateLinksInFileKeepingFrontmatterWikilinks(params: UpdateLinksInFileKeepingFrontmatterWikilinksParams): Promise<void> {
  const {
    isEmptyEmbedAliasAllowed,
    linkPathStyle,
    linkStyle,
    newSourcePathOrFile,
    offsetRange,
    oldSourcePathOrFile,
    shouldConvertFrontmatterWikilinksToMarkdown,
    shouldEscapeAlias,
    shouldIncludeAttachmentExtensionToEmbedAlias,
    shouldUpdateEmbedOnlyLinks,
    shouldUpdateFileNameAlias,
    shouldUseAngleBrackets,
    shouldUseLeadingDotForRelativePaths,
    shouldUseLeadingSlashForAbsolutePaths,
    ...options
  } = params;
  const { app } = options;

  if (isCanvasFile(newSourcePathOrFile) && !app.internalPlugins.getEnabledPluginById(InternalPluginName.Canvas)) {
    return;
  }

  await editLinks(normalizeOptionalProperties<EditLinksParams>({
    ...options,
    linkConverter: (link) =>
      shouldUpdateEmbedOnlyLinks !== undefined && shouldUpdateEmbedOnlyLinks !== hasEmbedSyntax(link.original)
        ? undefined
        : convertLink(normalizeOptionalProperties<ConvertLinkParams>({
          app,
          isEmptyEmbedAliasAllowed,
          link,
          linkPathStyle,
          linkStyle: getLinkStyleForReference({ linkStyle, reference: link, shouldConvertFrontmatterWikilinksToMarkdown }),
          newSourcePathOrFile,
          oldSourcePathOrFile,
          shouldEscapeAlias,
          shouldIncludeAttachmentExtensionToEmbedAlias,
          shouldUpdateFileNameAlias,
          shouldUseAngleBrackets,
          shouldUseLeadingDotForRelativePaths,
          shouldUseLeadingSlashForAbsolutePaths
        })),
    // Named beside the spread, as the library does, so a later refactor cannot drop it silently.
    offsetRange,
    pathOrFile: newSourcePathOrFile
  }));
}
