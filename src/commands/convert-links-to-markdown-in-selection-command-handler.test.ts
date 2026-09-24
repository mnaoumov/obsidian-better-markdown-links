import type {
  Editor,
  EditorPosition,
  MarkdownFileInfo,
  TFile
} from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { LinkConverter } from '../link-converter.ts';

vi.mock('obsidian-dev-utils/obsidian/file-system', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/file-system')>(),
  isMarkdownFile: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { ConvertLinksToMarkdownInSelectionCommandHandler } from './convert-links-to-markdown-in-selection-command-handler.ts';

interface TestableHandler {
  readonly canExecuteEditor: (editor: Editor, context: MarkdownFileInfo) => boolean;
  readonly executeEditor: (editor: Editor, context: MarkdownFileInfo) => Promise<void>;
  readonly icon: string;
  readonly id: string;
  readonly name: string;
  readonly shouldAddToEditorMenu: (editor: Editor, context: MarkdownFileInfo) => boolean;
}

const FROM_OFFSET = 10;
const TO_OFFSET = 42;

describe('ConvertLinksToMarkdownInSelectionCommandHandler', () => {
  let convertLinksInFile: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFile']>>;
  let handler: TestableHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    convertLinksInFile = vi.fn<LinkConverter['convertLinksInFile']>().mockResolvedValue(undefined);
    handler = castTo<TestableHandler>(
      new ConvertLinksToMarkdownInSelectionCommandHandler({
        linkConverter: strictProxy<LinkConverter>({ convertLinksInFile })
      })
    );
  });

  it('should be the selection sibling of the file, folder and vault commands', () => {
    expect(handler.id).toBe('convert-links-to-markdown-in-current-selection');
    expect(handler.name).toBe('Convert links to Markdown in current selection');
    expect(handler.icon).toBe('replace');
  });

  it('should grey out rather than treat an empty selection as the whole note', () => {
    expect(handler.canExecuteEditor(createEditor(true), createContext())).toBe(true);
    expect(handler.canExecuteEditor(createEditor(false), createContext())).toBe(false);
  });

  // Palette-only: `Convert links in selection` already sits in the editor menu, and a second, nearly
  // identically named row beside it would cost more than it explains.
  it('should stay out of the editor menu', () => {
    expect(handler.shouldAddToEditorMenu(createEditor(true), createContext())).toBe(false);
  });

  it('should convert only within the selection, as the explicit file command does', async () => {
    const context = createContext();

    await handler.executeEditor(createEditor(true), context);

    expect(convertLinksInFile).toHaveBeenCalledExactlyOnceWith({
      file: context.file,
      offsetRange: {
        endOffset: TO_OFFSET,
        startOffset: FROM_OFFSET
      },
      shouldForceMarkdownLinkStyle: true,
      shouldPromptForExcludedFile: true,
      shouldResolveUnresolvedLinks: true
    });
  });
});

function createContext(): MarkdownFileInfo {
  return strictProxy<MarkdownFileInfo>({ file: strictProxy<TFile>({ path: 'notes/note.md' }) });
}

function createEditor(isSomethingSelected: boolean): Editor {
  const from = strictProxy<EditorPosition>({ ch: 0, line: 1 });
  const to = strictProxy<EditorPosition>({ ch: 7, line: 3 });
  return strictProxy<Editor>({
    getCursor: vi.fn((mode?: string) => mode === 'from' ? from : to),
    posToOffset: vi.fn((position: EditorPosition) => position === from ? FROM_OFFSET : TO_OFFSET),
    somethingSelected: vi.fn(() => isSomethingSelected)
  });
}
