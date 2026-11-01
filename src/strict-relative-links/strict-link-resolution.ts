import type {
  TFile,
  Vault
} from 'obsidian';

import { isFile } from '@mnaoumov/obsidian-lib/file-system';
import { join } from '@mnaoumov/typescript-lib/path';

/**
 * Resolves a link path the strict way: relative to the folder of the note holding the link, else as an exact
 * vault path, and never by a vault-wide match on the note's name, which is what core falls back to.
 *
 * - `[[issues]]` in `projects/a/note.md` reaches `projects/a/issues.md`, else `issues.md` at the vault root,
 *   and nothing else, however many other `issues.md` the vault holds.
 * - `[[./issues]]` and `[[../issues]]` are relative only, as core reads them too.
 * - `[[/folder/issues]]` is a vault path only.
 *
 * Both lookups try the path as written and then with `.md`, and match the path case-insensitively, as core does.
 *
 * @param vault - The vault to look the files up in.
 * @param linkPath - The link path, without its subpath.
 * @param sourcePath - The path of the note holding the link.
 * @returns The resolved files (none or one), or `null` to leave the lookup to core: a link with no path, which
 * links the note to itself, and a lookup with no source note, which is a name lookup rather than a link.
 */
export function resolveLinkPathStrictly(vault: Vault, linkPath: string, sourcePath: string): null | TFile[] {
  if (!linkPath || !sourcePath) {
    return null;
  }

  for (const candidatePath of getCandidatePaths(linkPath, sourcePath)) {
    const file = findFile(vault, candidatePath) ?? findFile(vault, `${candidatePath}.md`);
    if (file) {
      return [file];
    }
  }

  return [];
}

function findFile(vault: Vault, path: string): null | TFile {
  const file = vault.getFileByPath(path) ?? vault.getAbstractFileByPathInsensitive(path);
  return isFile(file) ? file : null;
}

function getCandidatePaths(linkPath: string, sourcePath: string): string[] {
  if (linkPath.startsWith('/')) {
    return [linkPath.slice(1)];
  }

  const slashIndex = sourcePath.lastIndexOf('/');
  const folderPath = slashIndex === -1 ? '' : sourcePath.slice(0, slashIndex);
  const relativePath = join(folderPath, linkPath);
  const candidatePaths = relativePath === '..' || relativePath.startsWith('../') ? [] : [relativePath];

  if (!linkPath.startsWith('./') && !linkPath.startsWith('../') && !candidatePaths.includes(linkPath)) {
    candidatePaths.push(linkPath);
  }

  return candidatePaths;
}
