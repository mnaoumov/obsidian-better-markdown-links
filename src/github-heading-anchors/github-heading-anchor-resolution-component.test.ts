import type {
  EmbedComponent,
  EmbedContext,
  EmbedCreator,
  MarkdownViewEphemeralState
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  CachedMetadata,
  HeadingCache,
  TFile
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { MarkdownView } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { PluginSettings } from '../settings/plugin-settings.ts';
import { GitHubHeadingAnchorResolutionComponent } from './github-heading-anchor-resolution-component.ts';

interface CreateComponentResult {
  readonly app: App;
  readonly embedCreator: ReturnType<typeof vi.fn<EmbedCreator>>;
  readonly getEmbedCreator: ReturnType<typeof vi.fn<(file: TFile) => EmbedCreator | null>>;
  readonly originalSetEphemeralState: ReturnType<typeof vi.fn>;
  readonly settings: PluginSettings;
}

interface SetEphemeralStateThis {
  readonly file: null | TFile;
}

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

const HEADINGS = [heading('My Heading', 1, 0), heading('Setup', 2, 1), heading('Usage', 1, 2), heading('Setup', 2, 3)];
const NOTE = strictProxy<TFile>({ extension: 'md', path: 'note.md' });
const EMBED_COMPONENT = strictProxy<EmbedComponent>({});
const EMBED_CONTEXT = strictProxy<EmbedContext>({});
const DEFAULT_CACHE: CachedMetadata = { headings: HEADINGS };
const loadedComponents: GitHubHeadingAnchorResolutionComponent[] = [];

function createComponent(cache: CachedMetadata | null = DEFAULT_CACHE): CreateComponentResult {
  const originalSetEphemeralState = vi.fn();
  castTo<Record<string, unknown>>(MarkdownView.prototype)['setEphemeralState'] = originalSetEphemeralState;
  const embedCreator = vi.fn<EmbedCreator>().mockReturnValue(EMBED_COMPONENT);
  const getEmbedCreator = vi.fn<(file: TFile) => EmbedCreator | null>().mockReturnValue(embedCreator);
  const app = strictProxy<App>({
    embedRegistry: { getEmbedCreator },
    metadataCache: {
      getFileCache: (): CachedMetadata | null => cache
    }
  });
  const settings = new PluginSettings();
  const component = new GitHubHeadingAnchorResolutionComponent({
    app,
    pluginSettingsComponent: strictProxy<PluginSettingsComponent>({ settings })
  });
  loadedComponents.push(component);
  component.load();
  return { app, embedCreator, getEmbedCreator, originalSetEphemeralState, settings };
}

function invokeSetEphemeralState(self: SetEphemeralStateThis, state: Partial<MarkdownViewEphemeralState>): void {
  castTo<(this: SetEphemeralStateThis, state: Partial<MarkdownViewEphemeralState>) => void>(MarkdownView.prototype.setEphemeralState)
    .call(self, state);
}

const originalPrototypeSetEphemeralState = MarkdownView.prototype.setEphemeralState;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  while (loadedComponents.length > 0) {
    loadedComponents.pop()?.unload();
  }

  castTo<Record<string, unknown>>(MarkdownView.prototype)['setEphemeralState'] = originalPrototypeSetEphemeralState;
});

describe('GitHubHeadingAnchorResolutionComponent', () => {
  describe('navigation', () => {
    it('should hand an anchor\'s heading over as the line to scroll to', () => {
      const { originalSetEphemeralState } = createComponent();

      invokeSetEphemeralState({ file: NOTE }, { scroll: 5, subpath: '#setup-1' });

      expect(originalSetEphemeralState).toHaveBeenCalledExactlyOnceWith({
        endLoc: null,
        line: 3,
        scroll: 5,
        startLoc: HEADINGS[3]?.position.start
      });
    });

    it('should report where the anchor\'s section ends', () => {
      const { originalSetEphemeralState } = createComponent();

      invokeSetEphemeralState({ file: NOTE }, { subpath: '#my-heading' });

      expect(originalSetEphemeralState).toHaveBeenCalledExactlyOnceWith({
        endLoc: HEADINGS[2]?.position.start,
        line: 0,
        startLoc: HEADINGS[0]?.position.start
      });
    });

    it('should leave a subpath core resolves, an unknown one and a missing one alone', () => {
      const { originalSetEphemeralState } = createComponent();

      for (const state of [{ subpath: '#Usage' }, { subpath: '#missing' }, { scroll: 1 }]) {
        invokeSetEphemeralState({ file: NOTE }, state);
        expect(originalSetEphemeralState).toHaveBeenLastCalledWith(state);
      }
    });

    it('should leave the state alone with resolution off, no file, a non-note or no cache', () => {
      const context = createComponent();
      const state = { subpath: '#setup-1' };

      invokeSetEphemeralState({ file: null }, state);
      expect(context.originalSetEphemeralState).toHaveBeenLastCalledWith(state);

      invokeSetEphemeralState({ file: strictProxy<TFile>({ extension: 'pdf', path: 'x.pdf' }) }, state);
      expect(context.originalSetEphemeralState).toHaveBeenLastCalledWith(state);

      context.settings.shouldResolveGitHubHeadingAnchors = false;
      invokeSetEphemeralState({ file: NOTE }, state);
      expect(context.originalSetEphemeralState).toHaveBeenLastCalledWith(state);

      const noCache = createComponent(null);
      invokeSetEphemeralState({ file: NOTE }, state);
      expect(noCache.originalSetEphemeralState).toHaveBeenLastCalledWith(state);
    });
  });

  describe('embeds and hover previews', () => {
    it('should hand a note\'s embed creator the Obsidian subpath of an anchor', () => {
      const context = createComponent();
      const embedCreator = context.app.embedRegistry.getEmbedCreator(NOTE);

      expect(embedCreator?.(EMBED_CONTEXT, NOTE, '#setup-1')).toBe(EMBED_COMPONENT);
      expect(context.getEmbedCreator).toHaveBeenCalledExactlyOnceWith(NOTE);
      expect(context.embedCreator).toHaveBeenCalledExactlyOnceWith(EMBED_CONTEXT, NOTE, '#Usage#Setup');
    });

    it('should pass any other subpath through unchanged', () => {
      const context = createComponent();
      const embedCreator = context.app.embedRegistry.getEmbedCreator(NOTE);

      for (const subpath of ['#Usage', '#missing', undefined]) {
        embedCreator?.(EMBED_CONTEXT, NOTE, subpath);
        expect(context.embedCreator).toHaveBeenLastCalledWith(EMBED_CONTEXT, NOTE, subpath);
      }

      context.settings.shouldResolveGitHubHeadingAnchors = false;
      embedCreator?.(EMBED_CONTEXT, NOTE, '#setup-1');
      expect(context.embedCreator).toHaveBeenLastCalledWith(EMBED_CONTEXT, NOTE, '#setup-1');
    });

    it('should return no creator when the registry has none', () => {
      const context = createComponent();
      context.getEmbedCreator.mockReturnValue(null);

      expect(context.app.embedRegistry.getEmbedCreator(NOTE)).toBeNull();
    });
  });
});
