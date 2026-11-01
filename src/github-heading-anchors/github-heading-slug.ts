/**
 * @file
 *
 * GitHub's heading anchors, and the translation between them and Obsidian's own heading subpaths.
 *
 * GitHub (and every renderer that follows it, through `github-slugger`) gives each heading an anchor made from
 * its text: lowercased, every character that is not a letter, a mark, a digit, a connector punctuation (`_`), a
 * hyphen or a space dropped, and each space turned into a hyphen. The second heading with the same anchor gets
 * `-1`, the third `-2`, skipping any suffix another heading already took. Obsidian instead matches a `#heading`
 * subpath against the heading's text, so `[x](note.md#my-heading)` reaches nothing in Obsidian and
 * `[x](<note.md#My Heading>)` reaches nothing on GitHub.
 *
 * Everything here works on a note's cached headings, so it is pure and needs no app.
 */

import type { HeadingCache } from 'obsidian';

/**
 * The characters core strips from both sides before comparing a heading with a subpath segment. A copy of the
 * pattern Obsidian's `resolveSubpath` uses; `github-heading-anchors.desktop.integration.test.ts` pins that the
 * two still agree.
 */
const OBSIDIAN_HEADING_STRIPPED_CHARACTERS_REGEXP = /[!"#$%&()*+,.:;<=>?@^`{|}~/[\]\\\r\n]/g;

/**
 * Everything GitHub drops from a heading's text: anything that is not a letter, a mark, a digit, a connector
 * punctuation, a hyphen or a space.
 */
const GITHUB_SLUG_DROPPED_CHARACTERS_REGEXP = /[^\p{L}\p{M}\p{Nd}\p{Pc}\- ]/gu;

const HTML_TAG_REGEXP = /<[^>]*>/g;
const MARKDOWN_LINK_REGEXP = /!?\[(?<text>[^\]]*)\]\([^)]*\)/g;

/**
 * Where a subpath leads in a note.
 */
export interface HeadingTarget {
  /**
   * The heading.
   */
  readonly heading: HeadingCache;

  /**
   * The index of the heading in the note's `headings`.
   */
  readonly index: number;

  /**
   * The heading after the section it opens, if there is one.
   */
  readonly next?: HeadingCache;
}

/**
 * Finds the heading a GitHub anchor names.
 *
 * @param headings - The note's cached headings.
 * @param subpath - The subpath, starting with `#`. Only a single segment can be an anchor; it may be
 *   percent-encoded, as GitHub writes a non-ASCII anchor.
 * @returns The heading, or `null` if the subpath is no anchor of this note.
 */
export function findHeadingByGitHubAnchor(headings: readonly HeadingCache[], subpath: string): HeadingTarget | null {
  const segments = subpath.split('#').filter(Boolean);
  const segment = segments[0];
  if (segments.length !== 1 || segment === undefined || isNonHeadingSegment(segment)) {
    return null;
  }

  const anchor = safeDecodeUriComponent(segment).toLowerCase();
  const slugs = getGitHubHeadingSlugs(headings);
  const index = slugs.indexOf(anchor);
  const heading = headings[index];
  if (!heading) {
    return null;
  }

  const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
  return next ? { heading, index, next } : { heading, index };
}

/**
 * Finds the heading a subpath leads to the way Obsidian does, by heading text.
 *
 * A copy of the heading half of Obsidian's `resolveSubpath`: each `#`-separated segment matches, in order, a
 * deeper heading whose text equals it once both are stripped of punctuation and lowercased. A block (`#^id`) or
 * footnote (`#[^id]`) subpath leads to no heading.
 *
 * @param headings - The note's cached headings.
 * @param subpath - The subpath, starting with `#`.
 * @returns The heading, or `null` if Obsidian would find none.
 */
export function findHeadingByObsidianSubpath(headings: readonly HeadingCache[], subpath: string): HeadingTarget | null {
  const segments = subpath.split('#').filter(Boolean);
  const firstSegment = segments[0];
  if (firstSegment === undefined || isNonHeadingSegment(firstSegment)) {
    return null;
  }

  const normalizedSegments = segments.map((segment) => normalizeForObsidianMatch(segment));
  let matchedCount = 0;
  let matchedLevel = 0;
  let target: HeadingTarget | null = null;

  for (const [index, heading] of headings.entries()) {
    if (target) {
      if (heading.level <= matchedLevel) {
        return { ...target, next: heading };
      }

      continue;
    }

    if (!(heading.level > matchedLevel && normalizeForObsidianMatch(heading.heading) === normalizedSegments[matchedCount])) {
      continue;
    }

    matchedCount++;
    matchedLevel = heading.level;
    if (matchedCount === segments.length) {
      target = { heading, index };
    }
  }

  return target;
}

/**
 * The anchor GitHub gives each heading of a note, in order, with the `-1`, `-2` suffixes of repeated ones.
 *
 * @param headings - The note's cached headings.
 * @returns One anchor per heading.
 */
export function getGitHubHeadingSlugs(headings: readonly HeadingCache[]): string[] {
  const slugger = createGitHubSlugger();
  return headings.map((heading) => slugger(heading.heading));
}

/**
 * The subpath Obsidian itself resolves to a heading: its text, behind the text of every heading it sits under.
 *
 * The chain is what tells apart two headings with the same text in different sections. Two with the same text
 * under the same parent still share it, and Obsidian then picks the first, which is a limit of Obsidian's
 * subpaths rather than of this translation.
 *
 * @param headings - The note's cached headings.
 * @param target - The heading.
 * @returns The subpath, starting with `#`.
 */
export function getObsidianHeadingSubpath(headings: readonly HeadingCache[], target: HeadingTarget): string {
  const chain: HeadingCache[] = [];
  let level = Infinity;
  for (const heading of headings.slice(0, target.index + 1).reverse()) {
    if (!(heading.level < level)) {
      continue;
    }

    chain.unshift(heading);
    level = heading.level;
  }

  const fullSubpath = chain.map((heading) => `#${heading.heading}`).join('');
  const ownSubpath = `#${target.heading.heading}`;
  // The heading's own text is enough when Obsidian already finds this heading by it, and is what it writes itself.
  return findHeadingByObsidianSubpath(headings, ownSubpath)?.index === target.index ? ownSubpath : fullSubpath;
}

/**
 * The anchor GitHub gives a heading with this text, before any duplicate suffix.
 *
 * GitHub slugs the RENDERED text, so a markdown link counts by its text alone and an HTML tag not at all.
 *
 * @param headingText - The heading's text, as Obsidian caches it.
 * @returns The anchor, without the leading `#`.
 */
export function slugifyGitHubHeading(headingText: string): string {
  return headingText
    .replaceAll(MARKDOWN_LINK_REGEXP, '$<text>')
    .replaceAll(HTML_TAG_REGEXP, '')
    .trim()
    .toLowerCase()
    .replaceAll(GITHUB_SLUG_DROPPED_CHARACTERS_REGEXP, '')
    .replaceAll(' ', '-');
}

/**
 * Translates a GitHub anchor into the subpath Obsidian resolves to the same heading.
 *
 * @param headings - The note's cached headings.
 * @param subpath - The subpath of a link into the note, starting with `#`.
 * @returns The Obsidian subpath, or `null` when there is nothing to translate: Obsidian already finds a heading
 *   by this subpath, or the subpath is no anchor of the note.
 */
export function translateGitHubAnchorToObsidianSubpath(headings: readonly HeadingCache[], subpath: string): null | string {
  if (findHeadingByObsidianSubpath(headings, subpath)) {
    return null;
  }

  const target = findHeadingByGitHubAnchor(headings, subpath);
  return target ? getObsidianHeadingSubpath(headings, target) : null;
}

/**
 * Translates an Obsidian heading subpath into the GitHub anchor of the same heading.
 *
 * @param headings - The note's cached headings.
 * @param subpath - The subpath of a link into the note, starting with `#`.
 * @returns The anchor subpath, starting with `#`, or `null` when Obsidian finds no heading by this subpath —
 *   which includes a subpath that is already an anchor.
 */
export function translateObsidianSubpathToGitHubAnchor(headings: readonly HeadingCache[], subpath: string): null | string {
  const target = findHeadingByObsidianSubpath(headings, subpath);
  if (!target) {
    return null;
  }

  // The anchor of a heading depends on every heading before it, through the duplicate suffixes.
  const slugger = createGitHubSlugger();
  let slug = '';
  for (const heading of headings.slice(0, target.index + 1)) {
    slug = slugger(heading.heading);
  }

  return `#${slug}`;
}

/**
 * A slugger that hands out GitHub's anchors for the headings of one note, in order, the way `github-slugger`
 * does: a repeated anchor gets the next free `-<n>` suffix.
 *
 * @returns The slugger.
 */
function createGitHubSlugger(): (headingText: string) => string {
  const usedSlugs = new Set<string>();
  const suffixCounts = new Map<string, number>();
  return (headingText) => {
    const originalSlug = slugifyGitHubHeading(headingText);
    let count = suffixCounts.get(originalSlug) ?? 0;
    let slug = originalSlug;
    while (usedSlugs.has(slug)) {
      count++;
      slug = `${originalSlug}-${String(count)}`;
    }

    suffixCounts.set(originalSlug, count);
    usedSlugs.add(slug);
    return slug;
  };
}

function isNonHeadingSegment(segment: string): boolean {
  return segment.startsWith('^') || segment.startsWith('[^');
}

function normalizeForObsidianMatch(text: string): string {
  return text.replaceAll(OBSIDIAN_HEADING_STRIPPED_CHARACTERS_REGEXP, ' ').replaceAll(/\s+/g, ' ').trim().toLowerCase();
}

function safeDecodeUriComponent(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
