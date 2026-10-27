import type { CanvasReference } from '@mnaoumov/obsidian-lib/reference';
import type {
  FrontmatterLinkCache,
  ReferenceCache
} from 'obsidian';

import { LinkStyle } from '@mnaoumov/obsidian-lib/link';
import {
  describe,
  expect,
  it
} from 'vitest';

import { getLinkStyleForReference } from './frontmatter-wikilink-style.ts';

const FRONTMATTER_WIKILINK: FrontmatterLinkCache = { key: 'base', link: 'table.base', original: '[[table.base]]' };
const FRONTMATTER_MARKDOWN_LINK: FrontmatterLinkCache = { key: 'base', link: 'table.base', original: '[table](table.base)' };
const CANVAS_WIKILINK: CanvasReference = { ...FRONTMATTER_WIKILINK, isCanvas: true, nodeIndex: 0, type: 'text' };
const BODY_WIKILINK: ReferenceCache = {
  link: 'table.base',
  original: '[[table.base]]',
  position: {
    end: { col: 14, line: 0, offset: 14 },
    start: { col: 0, line: 0, offset: 0 }
  }
};

describe('getLinkStyleForReference', () => {
  it('should keep a frontmatter wikilink a wikilink while the setting is off', () => {
    expect(getLinkStyleForReference({
      linkStyle: LinkStyle.Markdown,
      reference: FRONTMATTER_WIKILINK,
      shouldConvertFrontmatterWikilinksToMarkdown: false
    })).toBe(LinkStyle.Wikilink);
    expect(getLinkStyleForReference({
      linkStyle: undefined,
      reference: FRONTMATTER_WIKILINK,
      shouldConvertFrontmatterWikilinksToMarkdown: false
    })).toBe(LinkStyle.Wikilink);
  });

  it('should leave a frontmatter wikilink to the run style when the setting is on', () => {
    expect(getLinkStyleForReference({
      linkStyle: LinkStyle.Markdown,
      reference: FRONTMATTER_WIKILINK,
      shouldConvertFrontmatterWikilinksToMarkdown: true
    })).toBe(LinkStyle.Markdown);
  });

  it('should leave a body link, a canvas link and a frontmatter markdown link to the run style', () => {
    for (const reference of [BODY_WIKILINK, CANVAS_WIKILINK, FRONTMATTER_MARKDOWN_LINK]) {
      expect(getLinkStyleForReference({
        linkStyle: LinkStyle.Markdown,
        reference,
        shouldConvertFrontmatterWikilinksToMarkdown: false
      })).toBe(LinkStyle.Markdown);
    }

    expect(getLinkStyleForReference({
      linkStyle: undefined,
      reference: FRONTMATTER_MARKDOWN_LINK,
      shouldConvertFrontmatterWikilinksToMarkdown: false
    })).toBeUndefined();
  });
});
