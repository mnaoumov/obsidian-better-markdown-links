import type { CanvasReference } from '@mnaoumov/obsidian-lib/reference';
import type {
  App,
  FrontmatterLinkCache,
  ReferenceCache
} from 'obsidian';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

vi.mock('@mnaoumov/obsidian-lib/link', async (importOriginal) => ({
  ...await importOriginal<typeof import('@mnaoumov/obsidian-lib/link')>(),
  convertLink: vi.fn(),
  editLinks: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  convertLink,
  editLinks,
  LinkStyle
} from '@mnaoumov/obsidian-lib/link';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  getLinkStyleForReference,
  updateLinksInFileKeepingFrontmatterWikilinks
} from './frontmatter-wikilink-style.ts';

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

function createApp(isCanvasPluginEnabled: boolean): App {
  return strictProxy<App>({
    internalPlugins: {
      getEnabledPluginById: vi.fn().mockReturnValue(isCanvasPluginEnabled ? {} : null)
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(editLinks).mockResolvedValue(undefined);
  vi.mocked(convertLink).mockReturnValue('converted');
});

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

describe('updateLinksInFileKeepingFrontmatterWikilinks', () => {
  it('should skip a canvas while the Canvas core plugin is disabled', async () => {
    await updateLinksInFileKeepingFrontmatterWikilinks({
      app: createApp(false),
      newSourcePathOrFile: 'board.canvas',
      pluginNoticeComponent: null,
      resourceLockComponent: null,
      shouldConvertFrontmatterWikilinksToMarkdown: false
    });

    expect(vi.mocked(editLinks)).not.toHaveBeenCalled();
  });

  it('should edit a canvas while the Canvas core plugin is enabled', async () => {
    await updateLinksInFileKeepingFrontmatterWikilinks({
      app: createApp(true),
      newSourcePathOrFile: 'board.canvas',
      pluginNoticeComponent: null,
      resourceLockComponent: null,
      shouldConvertFrontmatterWikilinksToMarkdown: false
    });

    expect(vi.mocked(editLinks)).toHaveBeenCalledOnce();
  });

  it('should forward the file params to editLinks and decide the style per reference', async () => {
    const app = createApp(true);
    const abortSignal = new AbortController().signal;
    const offsetRange = { endOffset: 10, startOffset: 0 };

    await updateLinksInFileKeepingFrontmatterWikilinks({
      abortSignal,
      app,
      linkStyle: LinkStyle.Markdown,
      newSourcePathOrFile: 'note.md',
      offsetRange,
      pluginNoticeComponent: null,
      resourceLockComponent: null,
      shouldConvertFrontmatterWikilinksToMarkdown: false,
      shouldUseAngleBrackets: true
    });

    const editLinksParams = vi.mocked(editLinks).mock.calls[0]?.[0];
    expect(editLinksParams).toMatchObject({ abortSignal, app, offsetRange, pathOrFile: 'note.md', pluginNoticeComponent: null, resourceLockComponent: null });

    expect(await editLinksParams?.linkConverter(FRONTMATTER_WIKILINK)).toBe('converted');
    expect(vi.mocked(convertLink)).toHaveBeenLastCalledWith({
      app,
      link: FRONTMATTER_WIKILINK,
      linkStyle: LinkStyle.Wikilink,
      newSourcePathOrFile: 'note.md',
      shouldUseAngleBrackets: true
    });

    await editLinksParams?.linkConverter(BODY_WIKILINK);
    expect(vi.mocked(convertLink).mock.lastCall?.[0].linkStyle).toBe(LinkStyle.Markdown);
  });

  it('should skip the links the embed-only filter excludes', async () => {
    await updateLinksInFileKeepingFrontmatterWikilinks({
      app: createApp(true),
      newSourcePathOrFile: 'note.md',
      pluginNoticeComponent: null,
      resourceLockComponent: null,
      shouldConvertFrontmatterWikilinksToMarkdown: false,
      shouldUpdateEmbedOnlyLinks: true
    });

    const linkConverter = vi.mocked(editLinks).mock.calls[0]?.[0].linkConverter;
    expect(await linkConverter?.(BODY_WIKILINK)).toBeUndefined();
    expect(await linkConverter?.({ ...BODY_WIKILINK, original: '![[table.base]]' })).toBe('converted');
    expect(vi.mocked(convertLink)).toHaveBeenCalledOnce();
  });
});
