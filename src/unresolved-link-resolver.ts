import type {
  App,
  TFile
} from 'obsidian';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { ResourceLockComponent } from 'obsidian-dev-utils/obsidian/resource-lock';

import {
  getLinkpath,
  parseFrontMatterAliases,
  Platform
} from 'obsidian';
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
  readonly pluginNoticeComponent: null | PluginNoticeComponent;
  readonly resourceLockComponent: null | ResourceLockComponent;

  /**
   * Whether a wikilink that still does not resolve after the alias lookup should have its note created.
   */
  readonly shouldCreateMissingNotes: boolean;

  /**
   * Whether a wikilink that Obsidian cannot resolve should be looked up against every note's
   * `aliases` frontmatter and basename.
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
 * Used only by {@link findNoteByAliasInVault}: the index normalizes its own keys, so the fast path
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
 * 1. Look the link text up against every note's `aliases` frontmatter and its basename. A markdown link
 *    cannot carry an alias the way `[[Some Alias]]` does, so without this step an alias-only wikilink
 *    converts into a link pointing at a note that does not exist. Answered from the `Advanced Metadata
 *    Cache` plugin's name index when that plugin is installed, and by a vault walk when it is not — see
 *    {@link findNoteByAlias}.
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
    pluginNoticeComponent,
    resourceLockComponent,
    shouldCreateMissingNotes,
    shouldResolveLinksViaAliases
  } = params;

  abortSignal.throwIfAborted();

  await editLinks({
    abortSignal,
    app,
    linkConverter: async (link) => {
      if (!hasWikilinkSyntax(link.original)) {
        return;
      }

      const linkPath = getLinkpath(link.link);
      if (!linkPath) {
        return;
      }

      if (app.metadataCache.getFirstLinkpathDest(linkPath, file.path)) {
        return;
      }

      let linkedNote = shouldResolveLinksViaAliases ? await findNoteByAlias(app, linkPath) : null;

      if (!linkedNote && shouldCreateMissingNotes) {
        linkedNote = await createNote(app, file, linkPath);
      }

      if (!linkedNote) {
        return;
      }

      return generateMarkdownLink({
        alias: link.displayText ?? '',
        app,
        originalLink: link.original,
        sourcePathOrFile: file,
        targetPathOrFile: linkedNote
      });
    },
    pathOrFile: file,
    pluginNoticeComponent,
    resourceLockComponent
  });
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
 * Looks a wikilink's text up against every note's `aliases` frontmatter and basename.
 *
 * Two implementations of one question. The index answers it in a map lookup and is used whenever it is
 * there; without it the vault is walked, which is what this plugin has always done and is
 * `O(vault)` per link — so converting a whole vault is `O(links x vault)`.
 *
 * The index's answer is taken as final rather than as a first attempt: it knows every name in the
 * vault, so "nothing carries this name" is an answer, and falling back to the walk on a miss would pay
 * the full cost on exactly the links that reach {@link createNote}.
 */
async function findNoteByAlias(app: App, linkPath: string): Promise<null | TFile> {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- `getLinkSuggestions` is never called here and never separated from its object: it is read as the function OBJECT the graft hangs off, and what is taken off it is an arrow closure.
  const { getPathsByNameSafe } = app.metadataCache.getLinkSuggestions as Partial<GetPathsByNameWrapper>;
  return getPathsByNameSafe
    ? findNoteByAliasInIndex(app, await getPathsByNameSafe(linkPath))
    : findNoteByAliasInVault(app, linkPath);
}

/**
 * Picks the note to point at out of the index's answer.
 *
 * **Markdown only**, because the index is wider than this lookup: it walks `vault.getFiles()` filtered
 * by `metadataCache.isSupportedFile`, so a canvas could answer to a name where
 * {@link findNoteByAliasInVault}'s `getMarkdownFiles()` never would. Narrowing it here keeps the two
 * implementations answering the same question.
 *
 * **The first one wins**, and when several notes carry the name that choice is arbitrary — as it
 * already is in the walk, which stops at the first match in vault order. The index says so out loud
 * (its answer is a complete, unranked list) where the walk merely hid it.
 */
function findNoteByAliasInIndex(app: App, paths: readonly string[]): null | TFile {
  for (const path of paths) {
    if (!isMarkdownFile(path)) {
      continue;
    }

    const file = getFileOrNull({ app, pathOrFile: path });
    if (file) {
      return file;
    }
  }

  return null;
}

function findNoteByAliasInVault(app: App, linkPath: string): null | TFile {
  const normalizedLinkPath = normalizeAlias(linkPath);

  for (const markdownFile of app.vault.getMarkdownFiles()) {
    const aliases = parseFrontMatterAliases(app.metadataCache.getFileCache(markdownFile)?.frontmatter) ?? [];
    aliases.push(markdownFile.basename);
    if (aliases.some((alias) => normalizeAlias(alias) === normalizedLinkPath)) {
      return markdownFile;
    }
  }

  return null;
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
