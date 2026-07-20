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
  FilesMenuEventHandler
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
import { ConvertLinksInFileCommandHandler } from './convert-links-in-file-command-handler.ts';

let app: AppOriginal;

interface MenuItemMock {
  onClick(callback: () => void): MenuItemMock;
  setIcon(): MenuItemMock;
  setSection(): MenuItemMock;
  setTitle(): MenuItemMock;
}

interface MenuMock {
  addItem: ReturnType<typeof vi.fn>;
  menu: MenuOriginal;
}

describe('ConvertLinksInFileCommandHandler', () => {
  let activeFile: null | TFileOriginal;
  let convertLinksInFile: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFile']>>;
  let fileMenuHandlers: FileMenuEventHandler[];
  let handler: ConvertLinksInFileCommandHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    app = App.createConfigured__().asOriginalType__();
    convertLinksInFile = vi.fn<LinkConverter['convertLinksInFile']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFile });
    handler = new ConvertLinksInFileCommandHandler({ linkConverter });

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
        }
      },
      pluginName: 'Better Markdown Links'
    };
    // Call through the base `CommandHandler` type, whose `onRegistered` accurately declares an awaitable `Promise`-like return that the `AbstractFileCommandHandler` types narrow to `void`.
    await castTo<CommandHandler>(handler).onRegistered(context);
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinksInFileCommandHandler);
  });

  it('should allow executing when the active file is a markdown file', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    activeFile = createFile('note.md');

    const canExecute = handler.buildCommand().checkCallback?.(true);

    expect(canExecute).toBe(true);
    expect(vi.mocked(isMarkdownFile)).toHaveBeenCalledWith(activeFile);
  });

  it('should not allow executing when the active file is not a markdown file', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    activeFile = createFile('image.png');

    const canExecute = handler.buildCommand().checkCallback?.(true);

    expect(canExecute).toBe(false);
  });

  it('should add markdown files to the file menu', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    const file = createFile('note.md');
    const { addItem, menu } = createMenu();

    fileMenuHandlers[0]?.(menu, file, 'file-explorer-context-menu');

    expect(addItem).toHaveBeenCalledOnce();
    expect(vi.mocked(isMarkdownFile)).toHaveBeenCalledWith(file);
  });

  it('should not add non-markdown files to the file menu', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    const file = createFile('image.png');
    const { addItem, menu } = createMenu();

    fileMenuHandlers[0]?.(menu, file, 'file-explorer-context-menu');

    expect(addItem).not.toHaveBeenCalled();
  });

  it('should convert links in the file when the menu item is clicked', async () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    const file = createFile('note.md');
    const { menu } = createMenu();

    fileMenuHandlers[0]?.(menu, file, 'file-explorer-context-menu');

    await vi.waitFor(() => {
      expect(convertLinksInFile).toHaveBeenCalledWith({
        file,
        shouldPromptForExcludedFile: true
      });
    });
  });

  function createFile(path: string): TFileOriginal {
    return TFile.create__(castTo(app.vault), path).asOriginalType2__();
  }

  function createMenu(): MenuMock {
    const menu = strictProxy<MenuOriginal>({});
    const addItem = vi.fn((callback: (item: MenuItemMock) => void) => {
      const item: MenuItemMock = {
        onClick: vi.fn((clickCallback: () => void): MenuItemMock => {
          clickCallback();
          return item;
        }),
        setIcon: vi.fn((): MenuItemMock => item),
        setSection: vi.fn((): MenuItemMock => item),
        setTitle: vi.fn((): MenuItemMock => item)
      };
      callback(item);
      return menu;
    });
    Object.assign(menu, {
      addItem,
      setSectionSubmenu: vi.fn()
    });
    return {
      addItem,
      menu
    };
  }
});
