import type {
  App,
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

const { mockBaseCanExecute, mockBaseExecute } = vi.hoisted(() => ({
  mockBaseCanExecute: vi.fn<() => boolean>(),
  mockBaseExecute: vi.fn<() => Promise<void>>()
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/file-command-handler', () => ({
  FileCommandHandler: class {
    protected canExecute(): boolean {
      return mockBaseCanExecute();
    }

    protected async execute(): Promise<void> {
      await mockBaseExecute();
    }
  }
}));

vi.mock('obsidian-dev-utils/obsidian/file-system', () => ({
  isMarkdownFile: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { ConvertLinksInFileCommandHandler } from './convert-links-in-file-command-handler.ts';

interface CommandHandlerPrivate {
  canExecuteFile(file: TFile): boolean;
  executeFile(file: TFile): Promise<void>;
  shouldAddToFileMenu(file: TFile): boolean;
}

function asPrivate(handler: ConvertLinksInFileCommandHandler): CommandHandlerPrivate {
  return castTo<CommandHandlerPrivate>(handler);
}

describe('ConvertLinksInFileCommandHandler', () => {
  let convertLinksInFile: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFile']>>;
  let app: App;
  let handler: ConvertLinksInFileCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseCanExecute.mockReturnValue(true);
    mockBaseExecute.mockResolvedValue(undefined);
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    convertLinksInFile = vi.fn<LinkConverter['convertLinksInFile']>().mockResolvedValue(undefined);
    app = strictProxy<App>({});
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFile });
    handler = new ConvertLinksInFileCommandHandler({ app, linkConverter });
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinksInFileCommandHandler);
  });

  describe('canExecuteFile', () => {
    it('should return false when the base handler cannot execute', () => {
      mockBaseCanExecute.mockReturnValue(false);
      const file = strictProxy<TFile>({ path: 'note.md' });

      expect(asPrivate(handler).canExecuteFile(file)).toBe(false);
      expect(vi.mocked(isMarkdownFile)).not.toHaveBeenCalled();
    });

    it('should return true for a markdown file when the base handler can execute', () => {
      const file = strictProxy<TFile>({ path: 'note.md' });

      expect(asPrivate(handler).canExecuteFile(file)).toBe(true);
      expect(vi.mocked(isMarkdownFile)).toHaveBeenCalledWith(app, file);
    });

    it('should return false for a non-markdown file when the base handler can execute', () => {
      vi.mocked(isMarkdownFile).mockReturnValue(false);
      const file = strictProxy<TFile>({ path: 'image.png' });

      expect(asPrivate(handler).canExecuteFile(file)).toBe(false);
    });
  });

  describe('shouldAddToFileMenu', () => {
    it('should add markdown files to the file menu', () => {
      const file = strictProxy<TFile>({ path: 'note.md' });

      expect(asPrivate(handler).shouldAddToFileMenu(file)).toBe(true);
    });

    it('should not add non-markdown files to the file menu', () => {
      vi.mocked(isMarkdownFile).mockReturnValue(false);
      const file = strictProxy<TFile>({ path: 'image.png' });

      expect(asPrivate(handler).shouldAddToFileMenu(file)).toBe(false);
    });
  });

  describe('executeFile', () => {
    it('should convert links in the file prompting for excluded files', async () => {
      const file = strictProxy<TFile>({ path: 'note.md' });

      await asPrivate(handler).executeFile(file);

      expect(mockBaseExecute).toHaveBeenCalledOnce();
      expect(convertLinksInFile).toHaveBeenCalledExactlyOnceWith({
        file,
        shouldPromptForExcludedFile: true
      });
    });
  });
});
