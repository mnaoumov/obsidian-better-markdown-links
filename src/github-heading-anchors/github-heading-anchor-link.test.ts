import type {
  App,
  CachedMetadata,
  HeadingCache,
  TFile
} from 'obsidian';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it
} from 'vitest';

import { toGitHubHeadingAnchorLink } from './github-heading-anchor-link.ts';

function heading(text: string, line: number): HeadingCache {
  return {
    heading: text,
    level: 1,
    position: {
      end: { col: text.length + 2, line, offset: line * 100 + text.length + 2 },
      start: { col: 0, line, offset: line * 100 }
    }
  };
}

const TARGET_FILE = strictProxy<TFile>({ extension: 'md', path: 'target.md' });

const DEFAULT_CACHE: CachedMetadata = { headings: [heading('My Heading', 0), heading('Other', 1)] };

function createApp(cache: CachedMetadata | null = DEFAULT_CACHE): App {
  return strictProxy<App>({
    metadataCache: {
      getFileCache: (): CachedMetadata | null => cache
    }
  });
}

describe('toGitHubHeadingAnchorLink', () => {
  it('should rewrite the heading subpath of an angle-bracket link', () => {
    expect(toGitHubHeadingAnchorLink({ app: createApp(), linkText: '[x](<target.md#My Heading>)', targetFile: TARGET_FILE }))
      .toBe('[x](<target.md#my-heading>)');
  });

  it('should rewrite the heading subpath of an encoded link, an embed and a link with a title', () => {
    const app = createApp();
    expect(toGitHubHeadingAnchorLink({ app, linkText: '[x](target.md#My%20Heading)', targetFile: TARGET_FILE }))
      .toBe('[x](target.md#my-heading)');
    expect(toGitHubHeadingAnchorLink({ app, linkText: '![](<target.md#Other>)', targetFile: TARGET_FILE }))
      .toBe('![](<target.md#other>)');
    expect(toGitHubHeadingAnchorLink({ app, linkText: '[x](target.md#Other "Tip")', targetFile: TARGET_FILE }))
      .toBe('[x](target.md#other "Tip")');
  });

  it('should rewrite a link to a heading of the same note', () => {
    expect(toGitHubHeadingAnchorLink({ app: createApp(), linkText: '[x](#My%20Heading)', targetFile: TARGET_FILE }))
      .toBe('[x](#my-heading)');
  });

  it('should leave wikilinks, external links, links without a subpath and unparsable text as written', () => {
    const app = createApp();
    for (const linkText of ['[[target#My Heading]]', '[x](https://example.com#My%20Heading)', '[x](target.md)', 'plain text']) {
      expect(toGitHubHeadingAnchorLink({ app, linkText, targetFile: TARGET_FILE })).toBe(linkText);
    }
  });

  it('should leave a link to no note, or to something that is not a note, as written', () => {
    const app = createApp();
    const linkText = '[x](<target.md#My Heading>)';
    expect(toGitHubHeadingAnchorLink({ app, linkText, targetFile: null })).toBe(linkText);
    expect(toGitHubHeadingAnchorLink({ app, linkText, targetFile: strictProxy<TFile>({ extension: 'pdf', path: 'target.pdf' }) }))
      .toBe(linkText);
  });

  it('should leave a block subpath, an unknown heading and an existing anchor as written', () => {
    const app = createApp();
    for (const linkText of ['[x](target.md#^block)', '[x](<target.md#Missing>)', '[x](target.md#my-heading)']) {
      expect(toGitHubHeadingAnchorLink({ app, linkText, targetFile: TARGET_FILE })).toBe(linkText);
    }
  });

  it('should leave a link into a note with no cached headings as written', () => {
    const linkText = '[x](<target.md#My Heading>)';
    expect(toGitHubHeadingAnchorLink({ app: createApp(null), linkText, targetFile: TARGET_FILE })).toBe(linkText);
    expect(toGitHubHeadingAnchorLink({ app: createApp({}), linkText, targetFile: TARGET_FILE })).toBe(linkText);
  });
});
