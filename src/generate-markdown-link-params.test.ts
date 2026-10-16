import type { App as AppOriginal } from 'obsidian';

import {
  LinkPathStyle as LibraryLinkPathStyle,
  LinkStyle as LibraryLinkStyle
} from '@mnaoumov/obsidian-lib/link';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import type {
  GenerateMarkdownLinkExtendedOptions,
  LinkPathStyle,
  LinkStyle
} from '../api.d.ts';

import { toGenerateMarkdownLinkParams } from './generate-markdown-link-params.ts';

describe('toGenerateMarkdownLinkParams', () => {
  let app: AppOriginal;

  beforeEach(() => {
    app = App.createConfigured__().asOriginalType__();
  });

  it('should pass options without a style through unchanged, adding the app', () => {
    const options: GenerateMarkdownLinkExtendedOptions = {
      alias: 'alias',
      sourcePathOrFile: 'source.md',
      targetPathOrFile: 'target.md'
    };

    expect(toGenerateMarkdownLinkParams(app, options)).toStrictEqual({
      alias: 'alias',
      app,
      sourcePathOrFile: 'source.md',
      targetPathOrFile: 'target.md'
    });
  });

  it.each(Object.values(LibraryLinkStyle))('should translate the link style %s to the library enum', (linkStyle) => {
    const params = toGenerateMarkdownLinkParams(app, {
      linkStyle: castTo<LinkStyle>(linkStyle),
      sourcePathOrFile: 'source.md',
      targetPathOrFile: 'target.md'
    });

    expect(params.linkStyle).toBe(linkStyle);
    expect(params.linkPathStyle).toBeUndefined();
  });

  it.each(Object.values(LibraryLinkPathStyle))('should translate the link path style %s to the library enum', (linkPathStyle) => {
    const params = toGenerateMarkdownLinkParams(app, {
      linkPathStyle: castTo<LinkPathStyle>(linkPathStyle),
      sourcePathOrFile: 'source.md',
      targetPathOrFile: 'target.md'
    });

    expect(params.linkPathStyle).toBe(linkPathStyle);
    expect(params.linkStyle).toBeUndefined();
  });
});
