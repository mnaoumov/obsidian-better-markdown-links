import type { App as AppOriginal } from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { AbstractInputSuggest } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

vi.mock('./link-suggestion-patch-component.ts', () => ({
  rewritePropertyValueLink: vi.fn(({ value }: RewriteParams) => `rewritten ${value}`)
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import type { PropertyValueSuggestItem } from './property-value-link-suggestion-patch-component.ts';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettings } from '../settings/plugin-settings.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { rewritePropertyValueLink } from './link-suggestion-patch-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PropertyValueLinkSuggestionPatchComponent } from './property-value-link-suggestion-patch-component.ts';

type OnSelectLink = (value: string, event_: KeyboardEvent | MouseEvent) => void;

interface RewriteParams {
  readonly value: string;
}

/**
 * A stand-in for core's Properties value suggester: its `selectSuggestion` commits `committedValue` through
 * `onSelectLink`, as the real one does for a finished link.
 */
class FakePropertyValueSuggest {
  public committedValue = '[[target]]';
  public onSelectLink = vi.fn<OnSelectLink>();
  public readonly sourcePath = 'folder/source.md';

  public getLinktextQuery(text: string): string {
    return text;
  }

  public selectSuggestion(_value: null | PropertyValueSuggestItem, event_: KeyboardEvent | MouseEvent): void {
    this.onSelectLink(this.committedValue, event_);
  }
}

/**
 * Another input suggester, which the component must leave alone.
 */
class OtherInputSuggest {
  public selectSuggestion(): void {
    // Nothing to do.
  }
}

Object.setPrototypeOf(FakePropertyValueSuggest.prototype, AbstractInputSuggest.prototype);
Object.setPrototypeOf(OtherInputSuggest.prototype, AbstractInputSuggest.prototype);

const ORIGINAL_SELECT_SUGGESTION = FakePropertyValueSuggest.prototype.selectSuggestion;
const EVT = castTo<KeyboardEvent>({ key: 'Enter' });

function open(suggest: object): void {
  castTo<AbstractInputSuggest<unknown>>(suggest).open();
}

describe('PropertyValueLinkSuggestionPatchComponent', () => {
  let app: AppOriginal;
  let component: PropertyValueLinkSuggestionPatchComponent;
  let originalOpen: ReturnType<typeof vi.fn<() => void>>;
  let settings: PluginSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    originalOpen = vi.fn<() => void>();
    vi.spyOn(AbstractInputSuggest.prototype, 'open').mockImplementation(originalOpen);
    app = App.createConfigured__({}).asOriginalType__();
    settings = new PluginSettings();
    component = new PropertyValueLinkSuggestionPatchComponent({
      app,
      pluginSettingsComponent: strictProxy<PluginSettingsComponent>({ settings })
    });
    component.load();
  });

  afterEach(() => {
    component.unload();
    vi.restoreAllMocks();
  });

  it('should still open the suggester', () => {
    open(new FakePropertyValueSuggest());

    expect(originalOpen).toHaveBeenCalledOnce();
  });

  it('should rewrite the link a chosen link suggestion commits, with the settings and the source path', () => {
    settings.shouldConvertFrontmatterWikilinksToMarkdown = true;
    const suggest = new FakePropertyValueSuggest();
    const onSelectLink = suggest.onSelectLink;
    open(suggest);

    suggest.selectSuggestion({ type: 'file' }, EVT);

    expect(onSelectLink).toHaveBeenCalledExactlyOnceWith('rewritten [[target]]', EVT);
    expect(vi.mocked(rewritePropertyValueLink)).toHaveBeenCalledExactlyOnceWith({
      app,
      shouldConvertFrontmatterWikilinksToMarkdown: true,
      shouldUseGitHubHeadingAnchors: false,
      sourcePath: 'folder/source.md',
      value: '[[target]]'
    });
    expect(suggest.onSelectLink).toBe(onSelectLink);
  });

  it('should rewrite in a suggester opened before another of the same class', () => {
    open(new FakePropertyValueSuggest());
    const suggest = new FakePropertyValueSuggest();
    open(suggest);

    suggest.selectSuggestion({ type: 'file' }, EVT);

    expect(suggest.onSelectLink).toHaveBeenCalledExactlyOnceWith('rewritten [[target]]', EVT);
  });

  it.each([
    ['a value suggestion', { type: 'text' }],
    ['the typed value (Shift+Enter)', null]
  ])('should commit %s untouched', (_name, value) => {
    const suggest = new FakePropertyValueSuggest();
    open(suggest);

    suggest.selectSuggestion(value, EVT);

    expect(suggest.onSelectLink).toHaveBeenCalledExactlyOnceWith('[[target]]', EVT);
    expect(vi.mocked(rewritePropertyValueLink)).not.toHaveBeenCalled();
  });

  it('should restore onSelectLink when committing throws', () => {
    const suggest = new FakePropertyValueSuggest();
    const onSelectLink = suggest.onSelectLink;
    onSelectLink.mockImplementation(() => {
      throw new Error('commit failed');
    });
    open(suggest);

    expect(() => {
      suggest.selectSuggestion({ type: 'file' }, EVT);
    }).toThrow('commit failed');
    expect(suggest.onSelectLink).toBe(onSelectLink);
  });

  it('should leave another input suggester alone', () => {
    const original = OtherInputSuggest.prototype.selectSuggestion;

    open(new OtherInputSuggest());

    expect(OtherInputSuggest.prototype.selectSuggestion).toBe(original);
  });

  it('should restore the suggester class on unload', () => {
    open(new FakePropertyValueSuggest());

    component.unload();

    expect(FakePropertyValueSuggest.prototype.selectSuggestion).toBe(ORIGINAL_SELECT_SUGGESTION);
  });
});
