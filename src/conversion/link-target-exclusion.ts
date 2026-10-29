import type { ReadonlyPluginSettings } from '@mnaoumov/obsidian-lib/components/plugin-settings-component';
import type {
  App,
  Reference,
  TFile
} from 'obsidian';

import {
  extractReferenceFile,
  splitSubpath
} from '@mnaoumov/obsidian-lib/link';
import { isParseLinkReference } from '@mnaoumov/obsidian-lib/parse-link';

import type { PluginSettings } from '../settings/plugin-settings.ts';

/**
 * Params for {@link getLinkTargetExclusionPredicate}.
 */
export interface GetLinkTargetExclusionPredicateParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The plugin settings whose `excludeLinkTargetPaths` decide.
   */
  readonly settings: ReadonlyPluginSettings<PluginSettings>;

  /**
   * The note holding the references, which an unresolved relative link is resolved against.
   */
  readonly sourceFile: TFile;
}

/**
 * Params for {@link getReferenceTargetPath}.
 */
export interface GetReferenceTargetPathParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The reference whose target is wanted.
   */
  readonly reference: Reference;

  /**
   * The note holding the reference.
   */
  readonly sourceFile: TFile;
}

/**
 * The `shouldSkipReference` predicate every link-rewriting pass hands `@mnaoumov/obsidian-lib`, so a link whose
 * target matches `excludeLinkTargetPaths` is left exactly as written: not converted, restyled, normalized,
 * demoted or resolved (issue #45).
 *
 * The converter's three passes, the embed demoter and the automatic-conversion probe all build it here, so
 * they cannot disagree; a probe that counted a link the converter then skipped would re-run a no-op
 * conversion on every save.
 *
 * @param params - See {@link GetLinkTargetExclusionPredicateParams}.
 * @returns The predicate, or `undefined` when nothing is excluded, so no target is ever computed for nothing.
 */
export function getLinkTargetExclusionPredicate(params: GetLinkTargetExclusionPredicateParams): ((reference: Reference) => boolean) | undefined {
  const { app, settings, sourceFile } = params;
  return settings.excludeLinkTargetPaths.length === 0
    ? undefined
    : (reference): boolean => settings.isLinkTargetPathExcluded(getReferenceTargetPath({ app, reference, sourceFile }));
}

/**
 * The path a link's target is matched by.
 *
 * - A link that resolves: the vault path of the file it resolves to.
 * - A link that does not: the path it names, taken relative to the note as Obsidian would create it, so
 *   `[[missing.base]]` is matched as a `.base` target too. A path that climbs out of the vault falls back to
 *   the link path as written.
 * - An external link (`https://`, `file://`): its URL, since it names no vault file.
 *
 * @param params - See {@link GetReferenceTargetPathParams}.
 * @returns The target path.
 */
export function getReferenceTargetPath(params: GetReferenceTargetPathParams): string {
  const { app, reference, sourceFile } = params;
  // A frontmatter external link is a ParseLinkReference too, so this one test covers the body and the properties.
  if (isParseLinkReference(reference) && reference.parseLinkResult.isExternal) {
    return reference.parseLinkResult.url;
  }

  const targetFile = extractReferenceFile({
    app,
    reference,
    shouldAllowNonExistingFile: true,
    sourcePathOrFile: sourceFile
  });
  return targetFile?.path ?? splitSubpath(reference.link).linkPath;
}
