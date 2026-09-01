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
 * Obsidian treats aliases case-insensitively and collapses runs of whitespace, so `[[some  alias]]` and
 * `[[Some Alias]]` name the same note. Comparisons happen in this normalized space.
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
 *    converts into a link pointing at a note that does not exist.
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

      let linkedNote = shouldResolveLinksViaAliases ? findNoteByAlias(app, linkPath) : null;

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

function findNoteByAlias(app: App, linkPath: string): null | TFile {
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
