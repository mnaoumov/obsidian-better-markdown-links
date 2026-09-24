import type {
  App,
  TFile
} from 'obsidian';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { EditLinksParams } from 'obsidian-dev-utils/obsidian/link';
import type { OffsetRange } from 'obsidian-dev-utils/obsidian/reference';
import type { ResourceLockComponent } from 'obsidian-dev-utils/obsidian/resource-lock';

import {
  getLinkpath,
  parseFrontMatterAliases,
  Platform
} from 'obsidian';
import { normalizeOptionalProperties } from 'obsidian-dev-utils/object-utils';
import {
  getFileOrNull,
  isMarkdownFile
} from 'obsidian-dev-utils/obsidian/file-system';
import {
  editLinks,
  generateMarkdownLink,
  hasWikilinkSyntax
} from 'obsidian-dev-utils/obsidian/link';
import {
  createFolderSafe,
  getAvailablePath
} from 'obsidian-dev-utils/obsidian/vault';
import {
  dirname,
  join
} from 'obsidian-dev-utils/path';

/**
 * Parameters for {@link resolveUnresolvedLinksInFile}.
 */
export interface ResolveUnresolvedLinksInFileParams {
  readonly abortSignal: AbortSignal;
  readonly app: App;
  readonly file: TFile;

  /**
   * A character range within the file's content to confine the pass to — the editor selection, for the
   * `in selection` commands. A wikilink only partly inside it is left alone.
   *
   * @default `undefined`, meaning the whole file.
   */
  readonly offsetRange?: OffsetRange;

  readonly pluginNoticeComponent: null | PluginNoticeComponent;
  readonly resourceLockComponent: null | ResourceLockComponent;

  /**
   * Whether a wikilink that still does not resolve after the alias lookup should have its note created.
   *
   * Never reached by a link the lookup found AMBIGUOUS — see {@link findNotesByAlias}.
   */
  readonly shouldCreateMissingNotes: boolean;

  /**
   * Whether a wikilink that Obsidian cannot resolve should be looked up against every note's
   * `aliases` frontmatter and basename.
   *
   * Only an UNAMBIGUOUS answer is written: a name several notes carry leaves the link alone.
   */
  readonly shouldResolveLinksViaAliases: boolean;
}

/**
 * The reverse name lookup the `Advanced Metadata Cache` plugin's `Names` module grafts onto
 * `app.metadataCache.getLinkSuggestions` while it is on.
 *
 * Read off the CORE method rather than asked of the plugin, and duck-typed rather than declared as a
 * dependency — exactly as `obsidian-dev-utils` reads `.safe` off `getBacklinksForFile`
 * (`getBacklinksForFileSafe`). That buys three things a declared dependency would cost: this plugin
 * builds against `obsidian` alone, a user who has never heard of that plugin loses nothing, and the
 * fast path appears the moment one is installed with no release here.
 *
 * A function PROPERTY rather than a method, which is what the graft actually is: an arrow closure
 * assigned onto the patched function, so reading it off and calling it unbound is correct.
 */
interface GetPathsByNameWrapper {
  /**
   * Finds every note that answers to a name — its basename, or one of its `aliases` — from an index
   * rather than a vault walk, waiting for the index to be built first. Takes the name in any casing
   * and spacing, and answers with the vault-relative paths carrying it, unranked and complete.
   */
  readonly getPathsByNameSafe: (name: string) => Promise<string[]>;
}

/**
 * Obsidian treats aliases case-insensitively and collapses runs of whitespace, so `[[some  alias]]` and
 * `[[Some Alias]]` name the same note. Comparisons happen in this normalized space.
 *
 * Used only by {@link findNotesByAliasInVault}: the index normalizes its own keys, so the fast path
 * hands it the raw link text. The `Advanced Metadata Cache` plugin adopted these two rules verbatim
 * from here, which makes this a second copy of a definition rather than the only one — the two must
 * agree or the same link resolves differently depending on whether that plugin is installed.
 */
export function normalizeAlias(alias: string): string {
  return alias.toLowerCase().replaceAll(/ {2,}/g, ' ');
}

/**
 * Points wikilinks that Obsidian cannot resolve at a real note, so that the conversion to markdown links
 * that follows has something to write. Two strategies, each opt-in and applied in order:
 *
 * 1. Look the link text up against every note's `aliases` frontmatter and its basename, and point the
 *    link at the note when EXACTLY ONE answers to it. A markdown link cannot carry an alias the way
 *    `[[Some Alias]]` does, so without this step an alias-only wikilink converts into a link pointing
 *    at a note that does not exist. Answered from the `Advanced Metadata Cache` plugin's name index
 *    when that plugin is installed, and by a vault walk when it is not — see {@link findNotesByAlias}.
 * 2. Create the missing note, in the folder Obsidian's own *Default location for new notes* setting names.
 *
 * Only wikilinks are considered: resolving by alias is a wikilink idiom, and a markdown link that does not
 * resolve is far more likely to be a deliberate external or not-yet-written reference.
 *
 * The caller is responsible for only invoking this on an explicit user command — see
 * {@link LinkConverter.convertLinksInFile}, which never enables it on the automatic conversion paths.
 */
export async function resolveUnresolvedLinksInFile(params: ResolveUnresolvedLinksInFileParams): Promise<void> {
  const {
    abortSignal,
    app,
    file,
    offsetRange,
    pluginNoticeComponent,
    resourceLockComponent,
    shouldCreateMissingNotes,
    shouldResolveLinksViaAliases
  } = params;

  abortSignal.throwIfAborted();

  // A range is applied BEFORE `linkConverter` runs, so a wikilink outside the selection never reaches
  // `createNote` either: the selection bounds the side effect, not only the rewrite.
  await editLinks(normalizeOptionalProperties<EditLinksParams>({
    abortSignal,
    app,
    linkConverter: async (link) => {
      if (!hasWikilinkSyntax(link.original)) {
        return;
      }

      const linkPath = getLinkpath(link.link);
      if (!linkPath || app.metadataCache.getFirstLinkpathDest(linkPath, file.path)) {
        return;
      }

      const candidateNotes = shouldResolveLinksViaAliases ? await findNotesByAlias(app, linkPath) : [];

      // Several notes answer to this name, so there is no right answer to write and the link is left
      // exactly as it is - which preserves the unresolved marker Obsidian is deliberately showing.
      // Returning HERE rather than falling through as a miss is the load-bearing half: an ambiguous
      // name is not a missing one, and creating a third note that answers to it would be strictly
      // worse than the arbitrary pick this replaced.
      if (candidateNotes.length > 1) {
        return;
      }

      let linkedNote = candidateNotes[0] ?? null;

      if (!linkedNote && shouldCreateMissingNotes) {
        linkedNote = await createNote(app, file, linkPath);
      }

      return linkedNote
        ? generateMarkdownLink({
          alias: link.displayText ?? '',
          app,
          originalLink: link.original,
          sourcePathOrFile: file,
          targetPathOrFile: linkedNote
        })
        : undefined;
    },
    offsetRange,
    pathOrFile: file,
    pluginNoticeComponent,
    resourceLockComponent
  }));
}

async function createNote(app: App, sourceFile: TFile, linkPath: string): Promise<null | TFile> {
  const safeLinkPath = toSafeNotePath(linkPath);
  if (!safeLinkPath) {
    return null;
  }

  const parentFolder = app.fileManager.getNewFileParent(sourceFile.path);
  const notePath = getAvailablePath(app, join(parentFolder.path, `${safeLinkPath}.md`));
  await createFolderSafe(app, dirname(notePath));
  return await app.vault.create(notePath, '');
}

/**
 * Looks a wikilink's text up against every note's `aliases` frontmatter and basename, and answers with
 * EVERY note that carries it rather than with one of them.
 *
 * The complete list is the point. A name two notes answer to has no right answer, and the caller
 * declines to write one; a lookup that returned a single note could not tell that case apart from a
 * name that is unique, which is exactly the defect this shape removes.
 *
 * Two implementations of one question. The index answers it in a map lookup and is used whenever it is
 * there; without it the vault is walked, which is what this plugin has always done and is
 * `O(vault)` per link — so converting a whole vault is `O(links x vault)`. **The walk no longer stops
 * at its first hit**, because proving a name unambiguous means seeing the whole vault; that costs the
 * walk its early exit on a match, and is the price of the two implementations answering the same
 * question rather than two subtly different ones. Anyone who minds the cost installs the index.
 *
 * The index's answer is taken as final rather than as a first attempt: it knows every name in the
 * vault, so "nothing carries this name" is an answer, and falling back to the walk on a miss would pay
 * the full cost on exactly the links that reach {@link createNote}.
 */
async function findNotesByAlias(app: App, linkPath: string): Promise<readonly TFile[]> {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- `getLinkSuggestions` is never called here and never separated from its object: it is read as the function OBJECT the graft hangs off, and what is taken off it is an arrow closure.
  const { getPathsByNameSafe } = app.metadataCache.getLinkSuggestions as Partial<GetPathsByNameWrapper>;
  return getPathsByNameSafe
    ? findNotesByAliasInIndex(app, await getPathsByNameSafe(linkPath))
    : findNotesByAliasInVault(app, linkPath);
}

/**
 * Turns the index's answer into the notes it names.
 *
 * **Markdown only**, because the index is wider than this lookup: it walks `vault.getFiles()` filtered
 * by `metadataCache.isSupportedFile`, so a canvas could answer to a name where
 * {@link findNotesByAliasInVault}'s `getMarkdownFiles()` never would. Narrowing it here keeps the two
 * implementations answering the same question — and it now decides AMBIGUITY as well as resolution, so
 * a name carried by one note and one canvas is one candidate rather than two.
 *
 * A path no file answers to is dropped for the same reason: the index can name a path the vault has
 * since lost, and counting it would make a unique name look contested.
 */
function findNotesByAliasInIndex(app: App, paths: readonly string[]): readonly TFile[] {
  const notes: TFile[] = [];

  for (const path of paths) {
    if (!isMarkdownFile(path)) {
      continue;
    }

    const file = getFileOrNull({ app, pathOrFile: path });
    if (file) {
      notes.push(file);
    }
  }

  return notes;
}

function findNotesByAliasInVault(app: App, linkPath: string): readonly TFile[] {
  const normalizedLinkPath = normalizeAlias(linkPath);
  const notes: TFile[] = [];

  for (const markdownFile of app.vault.getMarkdownFiles()) {
    const aliases = parseFrontMatterAliases(app.metadataCache.getFileCache(markdownFile)?.frontmatter) ?? [];
    aliases.push(markdownFile.basename);
    if (aliases.some((alias) => normalizeAlias(alias) === normalizedLinkPath)) {
      notes.push(markdownFile);
    }
  }

  return notes;
}

/**
 * A wikilink's target is not necessarily a legal file name. Obsidian's own forbidden characters cannot
 * reach here (they terminate the link when parsed), but the platform's can, so they are stripped rather
 * than allowed to fail the whole conversion. Folder separators are deliberately preserved: `[[a/b]]`
 * names a note in a subfolder, and {@link createNote} creates that folder.
 */
function toSafeNotePath(linkPath: string): string {
  const platformForbiddenCharactersRegExp = Platform.isWin ? /[*"\\<>:|?]/g : /\\/g;
  return linkPath
    .replaceAll(platformForbiddenCharactersRegExp, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
    .join('/');
}
