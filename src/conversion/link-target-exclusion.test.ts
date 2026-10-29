import type {
  Reference,
  TFile
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { PluginSettings } from '../settings/plugin-settings.ts';
import {
  getLinkTargetExclusionPredicate,
  getReferenceTargetPath
} from './link-target-exclusion.ts';

interface Context {
  readonly app: ReturnType<App['asOriginalType__']>;
  readonly sourceFile: TFile;
}

function createContext(): Context {
  const appMock = App.createConfigured__({
    files: {
      'Bases/table.base': '',
      'folder/note.md': '',
      'other.md': ''
    }
  });
  const app = appMock.asOriginalType__();
  const sourceFile = app.vault.getFileByPath('folder/note.md');
  if (!sourceFile) {
    throw new Error('The seeded source note is missing');
  }

  return { app, sourceFile };
}

function makeExternalLink(url: string, isExternal = true): Reference {
  return castTo<Reference>({
    link: url,
    original: `[x](${url})`,
    parseLinkResult: { isExternal, url }
  });
}

function makeLink(link: string): Reference {
  return { link, original: `[[${link}]]` };
}

describe('getReferenceTargetPath', () => {
  it('should answer the path of the file a link resolves to', () => {
    const { app, sourceFile } = createContext();

    expect(getReferenceTargetPath({ app, reference: makeLink('table.base'), sourceFile })).toBe('Bases/table.base');
    expect(getReferenceTargetPath({ app, reference: makeLink('other'), sourceFile })).toBe('other.md');
  });

  it('should ignore the subpath of a link', () => {
    const { app, sourceFile } = createContext();

    expect(getReferenceTargetPath({ app, reference: makeLink('table.base#Heading'), sourceFile })).toBe('Bases/table.base');
  });

  it('should answer the path relative to the note for an unresolved link', () => {
    const { app, sourceFile } = createContext();

    expect(getReferenceTargetPath({ app, reference: makeLink('missing.base'), sourceFile })).toBe('folder/missing.base');
  });

  it('should answer the link path as written when an unresolved link climbs out of the vault', () => {
    const { app, sourceFile } = createContext();

    expect(getReferenceTargetPath({ app, reference: makeLink('../../missing.base'), sourceFile })).toBe('../../missing.base');
  });

  it('should answer the URL of an external link', () => {
    const { app, sourceFile } = createContext();

    expect(getReferenceTargetPath({ app, reference: makeExternalLink('file:///C:/x.base'), sourceFile })).toBe('file:///C:/x.base');
  });

  it('should resolve a parsed internal link like any other', () => {
    const { app, sourceFile } = createContext();

    expect(getReferenceTargetPath({ app, reference: makeExternalLink('table.base', false), sourceFile })).toBe('Bases/table.base');
  });
});

describe('getLinkTargetExclusionPredicate', () => {
  it('should answer no predicate when nothing is excluded', () => {
    const { app, sourceFile } = createContext();
    const settings = new PluginSettings();

    expect(getLinkTargetExclusionPredicate({ app, settings, sourceFile })).toBeNull();
  });

  it('should exclude a link whose target matches, and only that one', () => {
    const { app, sourceFile } = createContext();
    const settings = new PluginSettings();
    settings.excludeLinkTargetPaths = ['*.base'];

    const shouldSkipReference = getLinkTargetExclusionPredicate({ app, settings, sourceFile });

    expect(shouldSkipReference?.(makeLink('table.base'))).toBe(true);
    expect(shouldSkipReference?.(makeLink('missing.base'))).toBe(true);
    expect(shouldSkipReference?.(makeLink('other'))).toBe(false);
  });

  it('should match a regular expression entry against the target, not the note', () => {
    const { app, sourceFile } = createContext();
    const settings = new PluginSettings();
    settings.excludeLinkTargetPaths = [String.raw`/^Bases\//`];

    const shouldSkipReference = getLinkTargetExclusionPredicate({ app, settings, sourceFile });

    expect(shouldSkipReference?.(makeLink('table.base'))).toBe(true);
    expect(shouldSkipReference?.(makeLink('missing.base'))).toBe(false);
  });
});
