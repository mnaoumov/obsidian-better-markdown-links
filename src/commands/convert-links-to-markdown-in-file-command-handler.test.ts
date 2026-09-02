import type {
  App as AppOriginal,
  Menu as MenuOriginal,
  TFile as TFileOriginal
} from 'obsidian';
import type { DisposableEx } from 'obsidian-dev-utils/disposable';
import type { ActiveFileProvider } from 'obsidian-dev-utils/obsidian/active-file-provider';
import type {
  CommandHandler,
  CommandHandlerRegistrationContext
} from 'obsidian-dev-utils/obsidian/command-handlers/command-handler';
import type {
  FileMenuEventHandler,
  FilesMenuEventHandler,
  MarkdownViewportMenuEventHandler
} from 'obsidian-dev-utils/obsidian/menu-event-registrar';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  App,
  TFile
} from 'obsidian-test-mocks/obsidian';
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
import { ConvertLinksToMarkdownInFileCommandHandler } from './convert-links-to-markdown-in-file-command-handler.ts';

let app: AppOriginal;

describe('ConvertLinksToMarkdownInFileCommandHandler', () => {
  let activeFile: null | TFileOriginal;
  let convertLinksInFile: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFile']>>;
  let fileMenuHandlers: FileMenuEventHandler[];
  let handler: ConvertLinksToMarkdownInFileCommandHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    app = App.createConfigured__().asOriginalType__();
    convertLinksInFile = vi.fn<LinkConverter['convertLinksInFile']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFile });
    handler = new ConvertLinksToMarkdownInFileCommandHandler({ linkConverter });

    activeFile = null;
    fileMenuHandlers = [];
    const activeFileProvider: ActiveFileProvider = { getActiveFile: () => activeFile };
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider,
      menuEventRegistrar: {
        registerEditorMenuEventHandler: vi.fn(),
        registerFileMenuEventHandler: (menuHandler: FileMenuEventHandler): DisposableEx => {
          fileMenuHandlers.push(menuHandler);
          return strictProxy<DisposableEx>({});
        },
        registerFilesMenuEventHandler: (_menuHandler: FilesMenuEventHandler): DisposableEx => {
          // The handler under test does not use the multi-file menu.
          return strictProxy<DisposableEx>({});
        },
        registerMarkdownViewportMenuEventHandler: (_menuHandler: MarkdownViewportMenuEventHandler): DisposableEx => {
          // The handler under test does not use the readable-line-length margin menu.
          return strictProxy<DisposableEx>({});
        }
      },
      pluginName: 'Better Markdown Links'
    };
    // Call through the base `CommandHandler` type, whose `onRegistered` accurately declares an awaitable `Promise`-like return that the `AbstractFileCommandHandler` types narrow to `void`.
    await castTo<CommandHandler>(handler).onRegistered(context);
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinksToMarkdownInFileCommandHandler);
  });

  it('should allow executing when the active file is a markdown file', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    activeFile = createFile('note.md');

    expect(handler.buildCommand().checkCallback?.(true)).toBe(true);
  });

  it('should not allow executing when the active file is not a markdown file', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    activeFile = createFile('image.png');

    expect(handler.buildCommand().checkCallback?.(true)).toBe(false);
  });

  it('should force the markdown style when executed', async () => {
    const file = createFile('note.md');
    activeFile = file;

    handler.buildCommand().checkCallback?.(false);

    await vi.waitFor(() => {
      expect(convertLinksInFile).toHaveBeenCalledExactlyOnceWith({
        file,
        shouldForceMarkdownLinkStyle: true,
        shouldPromptForExcludedFile: true,
        shouldResolveUnresolvedLinks: true
      });
    });
  });

  // The `Convert links in file` row is already in the file menu; a second, nearly identically named row
  // Beside it would cost more than it explains.
  it('should stay out of the file menu', () => {
    const file = createFile('note.md');
    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({
      addItem,
      setSectionSubmenu: vi.fn()
    });

    fileMenuHandlers[0]?.(menu, file, 'file-explorer-context-menu');

    expect(addItem).not.toHaveBeenCalled();
  });

  function createFile(path: string): TFileOriginal {
    return TFile.create__(castTo(app.vault), path).asOriginalType2__();
  }
});
