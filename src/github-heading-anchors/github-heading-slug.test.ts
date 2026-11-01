import type { HeadingCache } from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import type { HeadingTarget } from './github-heading-slug.ts';

import {
  findHeadingByGitHubAnchor,
  findHeadingByObsidianSubpath,
  getGitHubHeadingSlugs,
  getObsidianHeadingSubpath,
  slugifyGitHubHeading,
  translateGitHubAnchorToObsidianSubpath,
  translateObsidianSubpathToGitHubAnchor
} from './github-heading-slug.ts';

function heading(text: string, level: number, line: number): HeadingCache {
  return {
    heading: text,
    level,
    position: {
      end: { col: text.length + level + 1, line, offset: line * 100 + text.length + level + 1 },
      start: { col: 0, line, offset: line * 100 }
    }
  };
}

const HEADINGS = [
  heading('Intro', 1, 0),
  heading('Setup', 2, 1),
  heading('Usage', 1, 2),
  heading('Setup', 2, 3),
  heading('Setup-1', 2, 4)
];

function target(index: number): HeadingTarget {
  const targetHeading = HEADINGS[index];
  if (!targetHeading) {
    throw new Error(`No heading at ${String(index)}`);
  }

  return { heading: targetHeading, index };
}

describe('slugifyGitHubHeading', () => {
  it('should lowercase and turn spaces into hyphens', () => {
    expect(slugifyGitHubHeading('My Heading')).toBe('my-heading');
  });

  it('should drop punctuation and symbols but keep hyphens and underscores', () => {
    expect(slugifyGitHubHeading('What\'s new? (v2.0) - snake_case!')).toBe('whats-new-v20---snake_case');
  });

  it('should keep accented letters and drop emoji', () => {
    expect(slugifyGitHubHeading('Café Naïve 🎉')).toBe('café-naïve-');
  });

  it('should count a markdown link by its text and an HTML tag not at all', () => {
    expect(slugifyGitHubHeading('See [the docs](https://example.com) <b>now</b>')).toBe('see-the-docs-now');
  });

  it('should trim the text first', () => {
    expect(slugifyGitHubHeading('  Padded  ')).toBe('padded');
  });
});

describe('getGitHubHeadingSlugs', () => {
  it('should suffix repeated anchors and skip a suffix another heading already took', () => {
    expect(getGitHubHeadingSlugs([heading('A', 1, 0), heading('A', 1, 1), heading('A-1', 1, 2), heading('A', 1, 3)])).toEqual([
      'a',
      'a-1',
      'a-1-1',
      'a-2'
    ]);
  });

  it('should give the headings of HEADINGS their GitHub anchors', () => {
    expect(getGitHubHeadingSlugs(HEADINGS)).toEqual(['intro', 'setup', 'usage', 'setup-1', 'setup-1-1']);
  });
});

describe('findHeadingByObsidianSubpath', () => {
  it('should match a heading by its text, ignoring case and punctuation', () => {
    expect(findHeadingByObsidianSubpath(HEADINGS, '#usage')?.index).toBe(2);
    expect(findHeadingByObsidianSubpath([heading('What\'s new?', 1, 0)], '#What\'s new')?.index).toBe(0);
  });

  it('should match the first of two headings with the same text', () => {
    expect(findHeadingByObsidianSubpath(HEADINGS, '#Setup')?.index).toBe(1);
  });

  it('should follow a chain of nested headings', () => {
    expect(findHeadingByObsidianSubpath(HEADINGS, '#Usage#Setup')).toEqual({ heading: HEADINGS[3], index: 3, next: HEADINGS[4] });
  });

  it('should report the heading that closes the section', () => {
    expect(findHeadingByObsidianSubpath(HEADINGS, '#Intro')?.next).toBe(HEADINGS[2]);
  });

  it('should find nothing for a block, a footnote, an empty or an unknown subpath', () => {
    expect(findHeadingByObsidianSubpath(HEADINGS, '#^block')).toBeNull();
    expect(findHeadingByObsidianSubpath(HEADINGS, '#[^1]')).toBeNull();
    expect(findHeadingByObsidianSubpath(HEADINGS, '#')).toBeNull();
    expect(findHeadingByObsidianSubpath(HEADINGS, '#missing')).toBeNull();
  });
});

describe('findHeadingByGitHubAnchor', () => {
  it('should find a heading by its anchor, with its duplicate suffix', () => {
    expect(findHeadingByGitHubAnchor(HEADINGS, '#setup-1')).toEqual({ heading: HEADINGS[3], index: 3, next: HEADINGS[4] });
  });

  it('should leave next out for the last section', () => {
    expect(findHeadingByGitHubAnchor(HEADINGS, '#setup-1-1')).toEqual({ heading: HEADINGS[4], index: 4 });
  });

  it('should accept a percent-encoded or upper-case anchor', () => {
    expect(findHeadingByGitHubAnchor([heading('Café', 1, 0)], `#${encodeURIComponent('café')}`)?.index).toBe(0);
    expect(findHeadingByGitHubAnchor(HEADINGS, '#USAGE')?.index).toBe(2);
    expect(findHeadingByGitHubAnchor(HEADINGS, '#%E0%A4%A')).toBeNull();
  });

  it('should find nothing for a chain, a block, an empty or an unknown anchor', () => {
    expect(findHeadingByGitHubAnchor(HEADINGS, '#usage#setup')).toBeNull();
    expect(findHeadingByGitHubAnchor(HEADINGS, '#^block')).toBeNull();
    expect(findHeadingByGitHubAnchor(HEADINGS, '#')).toBeNull();
    expect(findHeadingByGitHubAnchor(HEADINGS, '#missing')).toBeNull();
  });
});

describe('getObsidianHeadingSubpath', () => {
  it('should use the heading text alone when Obsidian finds the heading by it', () => {
    expect(getObsidianHeadingSubpath(HEADINGS, target(1))).toBe('#Setup');
    expect(getObsidianHeadingSubpath(HEADINGS, target(4))).toBe('#Setup-1');
  });

  it('should prefix the parent headings when the text alone leads elsewhere', () => {
    expect(getObsidianHeadingSubpath(HEADINGS, target(3))).toBe('#Usage#Setup');
  });
});

describe('translateGitHubAnchorToObsidianSubpath', () => {
  it('should translate an anchor Obsidian cannot resolve', () => {
    expect(translateGitHubAnchorToObsidianSubpath(HEADINGS.slice(0, 4), '#setup-1')).toBe('#Usage#Setup');
  });

  it('should let Obsidian\'s own reading win when a heading\'s text equals another heading\'s anchor', () => {
    expect(translateGitHubAnchorToObsidianSubpath(HEADINGS, '#setup-1')).toBeNull();
  });

  it('should leave alone a subpath Obsidian resolves itself, and one that is no anchor', () => {
    expect(translateGitHubAnchorToObsidianSubpath(HEADINGS, '#Usage')).toBeNull();
    expect(translateGitHubAnchorToObsidianSubpath(HEADINGS, '#missing')).toBeNull();
  });
});

describe('translateObsidianSubpathToGitHubAnchor', () => {
  it('should translate a subpath Obsidian resolves into the anchor of the same heading', () => {
    expect(translateObsidianSubpathToGitHubAnchor(HEADINGS, '#Usage#Setup')).toBe('#setup-1');
    expect(translateObsidianSubpathToGitHubAnchor([heading('My Heading', 1, 0)], '#My Heading')).toBe('#my-heading');
  });

  it('should find nothing for a subpath Obsidian cannot resolve, so an anchor is never translated twice', () => {
    expect(translateObsidianSubpathToGitHubAnchor([heading('My Heading', 1, 0)], '#my-heading')).toBeNull();
  });
});
