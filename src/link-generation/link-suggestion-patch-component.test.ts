import type {
  App as AppOriginal,
  Editor,
  EditorPosition,
  EditorTransaction,
  TFile as TFileOriginal
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

vi.mock('@mnaoumov/obsidian-lib/link', async (importOriginal) => ({
  ...await importOriginal<typeof import('@mnaoumov/obsidian-lib/link')>(),
  generateMarkdownLink: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { generateMarkdownLink } from '@mnaoumov/obsidian-lib/link';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettings } from '../settings/plugin-settings.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  LinkSuggestionPatchComponent,
  rewriteAutocompleteTransaction
} from './link-suggestion-patch-component.ts';

interface EditorSuggestHolder {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The fixture installs its suggester list after creating the app.
  editorSuggest: EditorSuggestStub;
}

interface EditorSuggestStub {
  readonly suggests: readonly object[];
}

/**
 * A stand-in for Obsidian's link suggester: its `selectSuggestion` inserts `text` with one `input.autocomplete`
 * transaction, as the real one does.
 */
interface FakeLinkSuggest {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- A test clears the context after the patch is installed, as closing the suggester does.
  context: FakeSuggestContext | null;
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The patch replaces it, and a test installs a spy before it does.
  selectSuggestion: (this: FakeLinkSuggest, value: unknown, event_: unknown) => void;
  readonly suggestManager: object;
}

interface FakeSuggestContext {
  readonly editor: Editor;
  readonly file: null | TFileOriginal;
}

const AUTOCOMPLETE = 'input.autocomplete';
const LINE = 3;
const LINK_START_CH = 2;

function at(ch: number): EditorPosition {
  return { ch, line: LINE };
}

function createApp(): AppOriginal {
  return App.createConfigured__({
    files: {
      'folder/source.md': '',
      'folder/target with space.md': '# Section one\n'
    }
  }).asOriginalType__();
}

function insertion(text: string, cursorCh: number, extraChanges: NonNullable<EditorTransaction['changes']> = []): EditorTransaction {
  return {
    changes: [{ from: at(LINK_START_CH), text, to: at(LINK_START_CH + 5) }, ...extraChanges],
    selection: { from: at(cursorCh), to: at(cursorCh) }
  };
}

function rewrite(app: AppOriginal, tx: EditorTransaction, shouldUseGitHubHeadingAnchors = false): EditorTransaction {
  return rewriteAutocompleteTransaction({ app, shouldUseGitHubHeadingAnchors, sourcePath: 'folder/source.md', tx });
}

describe('rewriteAutocompleteTransaction', () => {
  let app: AppOriginal;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateMarkdownLink).mockReturnValue('[target with space](<./target with space.md>)');
    app = createApp();
  });

  it('should replace a finished markdown link and move the cursor after the new one', () => {
    const text = '[target with space](target%20with%20space.md)';

    const result = rewrite(app, insertion(text, LINK_START_CH + text.length));

    expect(result).toEqual({
      changes: [{ from: at(LINK_START_CH), text: '[target with space](<./target with space.md>)', to: at(LINK_START_CH + 5) }],
      selection: { from: at(LINK_START_CH + 45), to: at(LINK_START_CH + 45) }
    });
    expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledExactlyOnceWith({
      alias: 'target with space',
      app,
      isEmbed: false,
      sourcePathOrFile: 'folder/source.md',
      subpath: '',
      targetPathOrFile: app.vault.getFileByPath('folder/target with space.md')
    });
  });

  it('should pass the decoded heading subpath and no alias for a finished wikilink', () => {
    const text = '[[target with space#Section one]]';

    rewrite(app, insertion(text, LINK_START_CH + text.length));

    expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledExactlyOnceWith({
      app,
      isEmbed: false,
      sourcePathOrFile: 'folder/source.md',
      subpath: '#Section one',
      targetPathOrFile: app.vault.getFileByPath('folder/target with space.md')
    });
  });

  it('should resolve a link with an empty path to the source note', () => {
    const text = '[Section one](#Section%20one)';

    rewrite(app, insertion(text, LINK_START_CH + text.length));

    expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledWith(expect.objectContaining({
      subpath: '#Section one',
      targetPathOrFile: app.vault.getFileByPath('folder/source.md')
    }));
  });

  it('should keep the cursor in an empty caption the new link still has, and keep the other changes', () => {
    vi.mocked(generateMarkdownLink).mockReturnValue('[](<./target with space.md#^abc123>)');
    const blockIdChange = { from: at(LINE + 2), text: ' ^abc123' };

    const result = rewrite(app, insertion('[](target%20with%20space.md#^abc123)', LINK_START_CH + 1, [blockIdChange]));

    expect(result.changes).toEqual([
      { from: at(LINK_START_CH), text: '[](<./target with space.md#^abc123>)', to: at(LINK_START_CH + 5) },
      blockIdChange
    ]);
    expect(result.selection).toEqual({ from: at(LINK_START_CH + 1), to: at(LINK_START_CH + 1) });
  });

  it('should move the cursor after the link when the new link has a caption', () => {
    vi.mocked(generateMarkdownLink).mockReturnValue('[target with space](<./target with space.md>)');

    const result = rewrite(app, insertion('[](target%20with%20space.md)', LINK_START_CH + 1));

    expect(result.selection).toEqual({ from: at(LINK_START_CH + 45), to: at(LINK_START_CH + 45) });
  });

  it('should write a GitHub heading anchor when the setting is on', () => {
    vi.mocked(generateMarkdownLink).mockReturnValue('[Section one](<./target with space.md#Section one>)');
    vi.spyOn(app.metadataCache, 'getFileCache').mockReturnValue({
      headings: [{ heading: 'Section one', level: 1, position: { end: { col: 13, line: 0, offset: 13 }, start: { col: 0, line: 0, offset: 0 } } }]
    });
    const text = '[Section one](target%20with%20space.md#Section%20one)';

    const result = rewrite(app, insertion(text, LINK_START_CH + text.length), true);

    expect(result.changes?.[0]?.text).toBe('[Section one](<./target with space.md#section-one>)');
  });

  it.each(
    [
      ['a transaction with no changes', { selection: { from: at(0) } }],
      ['a transaction with no selection', { changes: [{ from: at(0), text: '[[target with space]]' }] }],
      ['a selection over text', { changes: [{ from: at(0), text: '[[target with space]]' }], selection: { from: at(0), to: at(5) } }],
      ['a selection over lines', { changes: [{ from: at(0), text: '[[target with space]]' }], selection: { from: at(21), to: { ch: 21, line: LINE + 1 } } }],
      ['text that is not a link', insertion('target with space', LINK_START_CH + 17)],
      ['text that is more than one link', insertion('x[[target with space]]', LINK_START_CH + 22)],
      ['an external link', insertion('[x](https://example.com)', LINK_START_CH + 24)],
      ['an embed', insertion('![[target with space]]', LINK_START_CH + 22)],
      ['an unfinished link with the cursor inside it', insertion('[[target with space#]]', LINK_START_CH + 20)],
      ['a captioned markdown link with the cursor in its caption', insertion('[x](target%20with%20space.md)', LINK_START_CH + 1)],
      ['a link to a note that does not exist', insertion('[[missing]]', LINK_START_CH + 11)]
    ] satisfies [string, EditorTransaction][]
  )('should leave %s untouched', (_name, tx) => {
    expect(rewrite(app, tx)).toBe(tx);
    expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
  });

  it('should accept a collapsed selection given by its start alone', () => {
    const text = '[[target with space]]';
    const tx: EditorTransaction = { changes: [{ from: at(LINK_START_CH), text }], selection: { from: at(LINK_START_CH + text.length) } };

    expect(rewrite(app, tx)).not.toBe(tx);
  });
});

describe('LinkSuggestionPatchComponent', () => {
  let app: AppOriginal;
  let linkSuggest: FakeLinkSuggest;
  let transaction: ReturnType<typeof vi.fn<(tx: EditorTransaction, origin?: string) => void>>;
  let editor: Editor;
  let insertedText: string;
  let insertedOrigin: string;

  function load(settings = new PluginSettings(), suggests: readonly object[] = [{}, linkSuggest]): LinkSuggestionPatchComponent {
    castTo<EditorSuggestHolder>(app.workspace).editorSuggest = { suggests };
    const component = new LinkSuggestionPatchComponent({
      app,
      pluginSettingsComponent: strictProxy<PluginSettingsComponent>({ settings })
    });
    component.load();
    return component;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateMarkdownLink).mockReturnValue('[[./target with space]]');
    app = createApp();
    insertedText = '[[target with space]]';
    insertedOrigin = AUTOCOMPLETE;
    transaction = vi.fn<(tx: EditorTransaction, origin?: string) => void>();
    editor = castTo<Editor>({ transaction });
    linkSuggest = {
      context: { editor, file: app.vault.getFileByPath('folder/source.md') },
      selectSuggestion(): void {
        this.context?.editor.transaction(insertion(insertedText, LINK_START_CH + insertedText.length), insertedOrigin);
      },
      suggestManager: {}
    };
  });

  it('should rewrite the link the suggester inserts, from the source note', () => {
    load();

    linkSuggest.selectSuggestion(null, null);

    expect(transaction).toHaveBeenCalledExactlyOnceWith(insertion('[[./target with space]]', LINK_START_CH + 23), AUTOCOMPLETE);
    expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledWith(expect.objectContaining({ sourcePathOrFile: 'folder/source.md' }));
  });

  it('should leave the editor unpatched once the suggestion is chosen', () => {
    load();

    linkSuggest.selectSuggestion(null, null);

    expect(editor.transaction).toBe(transaction);
  });

  it('should leave a transaction of another origin untouched', () => {
    insertedOrigin = 'input';
    load();

    linkSuggest.selectSuggestion(null, null);

    expect(transaction).toHaveBeenCalledExactlyOnceWith(insertion('[[target with space]]', LINK_START_CH + 21), 'input');
  });

  it('should only call through when the suggester has no context', () => {
    const selectSuggestion = vi.fn();
    linkSuggest.selectSuggestion = selectSuggestion;
    load();
    linkSuggest.context = null;

    linkSuggest.selectSuggestion('value', 'evt');

    expect(selectSuggestion).toHaveBeenCalledExactlyOnceWith('value', 'evt');
  });

  it('should patch nothing when no suggester is the link suggester', () => {
    const original = linkSuggest.selectSuggestion;

    load(new PluginSettings(), [{}]);

    expect(linkSuggest.selectSuggestion).toBe(original);
  });

  it('should restore the suggester on unload', () => {
    const original = linkSuggest.selectSuggestion;
    const component = load();

    component.unload();

    expect(linkSuggest.selectSuggestion).toBe(original);
  });
});
