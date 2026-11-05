import type {
  TFile as TFileOriginal,
  Vault
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { TFile } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { resolveLinkPathStrictly } from './strict-link-resolution.ts';

const PATHS = [
  'issues.md',
  'projects/a/issues.md',
  'projects/a/sub/deep.md',
  'projects/b/issues.md',
  'projects/b/only-in-b.md',
  'projects/Mixed Case.md',
  'image.png'
];

function createVault(paths: readonly string[] = PATHS): Vault {
  const files = new Map<string, TFileOriginal>();
  const vault = strictProxy<Vault>({
    getAbstractFileByPathInsensitive: (path: string): null | TFileOriginal => [...files.values()].find((file) => file.path.toLowerCase() === path.toLowerCase()) ?? null,
    getFileByPath: (path: string): null | TFileOriginal => files.get(path) ?? null
  });

  for (const path of paths) {
    files.set(path, TFile.create__(castTo(vault), path).asOriginalType2__());
  }

  return vault;
}

function resolvePath(linkPath: string, sourcePath: string): null | string[] {
  return resolveLinkPathStrictly(createVault(), linkPath, sourcePath)?.map((file) => file.path) ?? null;
}

describe('resolveLinkPathStrictly', () => {
  it('should resolve a name in the note\'s own folder before the vault root', () => {
    expect(resolvePath('issues', 'projects/a/note.md')).toEqual(['projects/a/issues.md']);
  });

  it('should fall back to the exact vault path', () => {
    expect(resolvePath('issues', 'projects/c/note.md')).toEqual(['issues.md']);
    expect(resolvePath('projects/b/issues', 'projects/a/note.md')).toEqual(['projects/b/issues.md']);
  });

  // The vault-wide name match core falls back to is exactly what strict resolution refuses.
  it('should not resolve a name that exists only in another folder', () => {
    expect(resolvePath('only-in-b', 'projects/a/note.md')).toEqual([]);
  });

  it('should resolve a path below the note\'s folder', () => {
    expect(resolvePath('sub/deep', 'projects/a/note.md')).toEqual(['projects/a/sub/deep.md']);
  });

  it('should resolve ./ and ../ links relative to the note only', () => {
    expect(resolvePath('./issues', 'projects/a/note.md')).toEqual(['projects/a/issues.md']);
    expect(resolvePath('../b/issues.md', 'projects/a/note.md')).toEqual(['projects/b/issues.md']);
    expect(resolvePath('./only-in-b', 'projects/a/note.md')).toEqual([]);
    expect(resolvePath('./projects/a/issues', 'projects/c/note.md')).toEqual([]);
  });

  it('should not climb above the vault root', () => {
    expect(resolvePath('../issues', 'note.md')).toEqual([]);
    expect(resolvePath('..', 'note.md')).toEqual([]);
  });

  it('should resolve a leading slash as a vault path only', () => {
    expect(resolvePath('/issues', 'projects/a/note.md')).toEqual(['issues.md']);
    expect(resolvePath('/deep', 'projects/a/sub/note.md')).toEqual([]);
  });

  it('should resolve a note at the vault root relative to the root', () => {
    expect(resolvePath('issues', 'note.md')).toEqual(['issues.md']);
  });

  it('should resolve a link that names its extension', () => {
    expect(resolvePath('../../image.png', 'projects/a/note.md')).toEqual(['image.png']);
    expect(resolvePath('image.png', 'projects/a/note.md')).toEqual(['image.png']);
  });

  it('should match the path case-insensitively, as core does', () => {
    expect(resolvePath('mixed case', 'projects/note.md')).toEqual(['projects/Mixed Case.md']);
  });

  it('should leave a link to the note itself to core', () => {
    expect(resolvePath('', 'projects/a/note.md')).toBeNull();
  });

  it('should leave a lookup with no source note to core', () => {
    expect(resolvePath('only-in-b', '')).toBeNull();
  });
});
