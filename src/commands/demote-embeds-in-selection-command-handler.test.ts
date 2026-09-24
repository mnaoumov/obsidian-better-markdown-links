import type {
  Editor,
  EditorPosition,
  MarkdownFileInfo,
  TFile
} from 'obsidian';
import type { OffsetRange } from 'obsidian-dev-utils/obsidian/reference';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { EmbedDemoter } from '../embed-demoter.ts';

vi.mock('obsidian-dev-utils/obsidian/file-system', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/file-system')>(),
  isMarkdownFile: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { DemoteEmbedsInSelectionCommandHandler } from './demote-embeds-in-selection-command-handler.ts';

interface DemotedWithRange {
  readonly offsetRange: OffsetRange;
}

interface EditorMock {
  editor: Editor;
  posToOffset: ReturnType<typeof vi.fn>;
}

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

describe('DemoteEmbedsInSelectionCommandHandler', () => {
  let demoteEmbedsInFile: ReturnType<typeof vi.fn<EmbedDemoter['demoteEmbedsInFile']>>;
  let handler: TestableHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    demoteEmbedsInFile = vi.fn<EmbedDemoter['demoteEmbedsInFile']>().mockResolvedValue(undefined);
    handler = castTo<TestableHandler>(
      new DemoteEmbedsInSelectionCommandHandler({
        embedDemoter: strictProxy<EmbedDemoter>({ demoteEmbedsInFile })
      })
    );
  });

  it('should be the selection sibling of the file, folder and vault commands', () => {
    expect(handler.id).toBe('demote-embeds-to-links-in-current-selection');
    expect(handler.name).toBe('Demote embeds to links in current selection');
    expect(handler.icon).toBe('link');
  });

  it('should allow executing when a markdown note has a selection', () => {
    expect(handler.canExecuteEditor(createEditor(true).editor, createContext())).toBe(true);
  });

  it('should grey out rather than treat an empty selection as the whole note', () => {
    expect(handler.canExecuteEditor(createEditor(false).editor, createContext())).toBe(false);
  });

  it('should not allow executing when the editor is not backed by a markdown note', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);

    expect(handler.canExecuteEditor(createEditor(true).editor, createContext())).toBe(false);
  });

  it('should offer itself in the editor menu on exactly the terms it can execute on', () => {
    const { editor } = createEditor(true);
    const context = createContext();

    expect(handler.shouldAddToEditorMenu(editor, context)).toBe(true);
    expect(handler.shouldAddToEditorMenu(createEditor(false).editor, context)).toBe(false);
  });

  it('should demote only within the selection, prompting if the note is excluded', async () => {
    const context = createContext();

    await handler.executeEditor(createEditor(true).editor, context);

    expect(demoteEmbedsInFile).toHaveBeenCalledWith({
      file: context.file,
      offsetRange: {
        endOffset: TO_OFFSET,
        startOffset: FROM_OFFSET
      },
      shouldPromptForExcludedFile: true
    });
  });

  it('should take the range from the selection ends verbatim, since both are exclusive already', async () => {
    // The guard against a plausible off-by-one "fix". Obsidian reports a link's `position.end.offset` as
    // the offset just past its last character, and dev-utils tests `end.offset <= endOffset`, so a
    // selection ending exactly where a link ends must keep that link. Subtracting one would drop it.
    const { editor, posToOffset } = createEditor(true);

    await handler.executeEditor(editor, createContext());

    expect(posToOffset).toHaveBeenCalledTimes(2);
    expect(castTo<DemotedWithRange>(demoteEmbedsInFile.mock.calls[0]?.[0]).offsetRange.endOffset).toBe(TO_OFFSET);
  });

  it('should do nothing when the editor is not backed by a file at all', async () => {
    await handler.executeEditor(createEditor(true).editor, strictProxy<MarkdownFileInfo>({ file: null }));

    expect(demoteEmbedsInFile).not.toHaveBeenCalled();
  });
});

function createContext(): MarkdownFileInfo {
  return strictProxy<MarkdownFileInfo>({ file: strictProxy<TFile>({ path: 'notes/note.md' }) });
}

function createEditor(isSomethingSelected: boolean): EditorMock {
  const from = strictProxy<EditorPosition>({ ch: 0, line: 1 });
  const to = strictProxy<EditorPosition>({ ch: 7, line: 3 });
  const posToOffset = vi.fn((position: EditorPosition) => position === from ? FROM_OFFSET : TO_OFFSET);
  return {
    editor: strictProxy<Editor>({
      getCursor: vi.fn((mode?: string) => mode === 'from' ? from : to),
      posToOffset,
      somethingSelected: vi.fn(() => isSomethingSelected)
    }),
    posToOffset
  };
}
