import type {
  App as AppOriginal,
  Menu as MenuOriginal,
  TFolder as TFolderOriginal
} from 'obsidian';
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
  TFolder
} from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { LinkConverter } from '../link-converter.ts';

import { ConvertLinksInFolderCommandHandler } from './convert-links-in-folder-command-handler.ts';

let app: AppOriginal;

describe('ConvertLinksInFolderCommandHandler', () => {
  let convertLinksInFolder: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFolder']>>;
  let fileMenuHandlers: FileMenuEventHandler[];
  let handler: ConvertLinksInFolderCommandHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = App.createConfigured__().asOriginalType__();
    convertLinksInFolder = vi.fn<LinkConverter['convertLinksInFolder']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFolder });
    handler = new ConvertLinksInFolderCommandHandler({ linkConverter });

    fileMenuHandlers = [];
    const activeFileProvider: ActiveFileProvider = { getActiveFile: () => null };
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider,
      menuEventRegistrar: {
        registerEditorMenuEventHandler: vi.fn(),
        registerFileMenuEventHandler: (menuHandler: FileMenuEventHandler): void => {
          fileMenuHandlers.push(menuHandler);
        },
        registerFilesMenuEventHandler: (_menuHandler: FilesMenuEventHandler): void => {
          // The handler under test does not use the multi-folder menu.
        }
      },
      pluginName: 'Better Markdown Links'
    };
    // Call through the base `CommandHandler` type, whose `onRegistered` accurately declares an awaitable `Promise`-like return that the `AbstractFileCommandHandler` types narrow to `void`.
    await castTo<CommandHandler>(handler).onRegistered(context);
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinksInFolderCommandHandler);
  });

  it('should always add to the folder menu', () => {
    const folder = createFolder('some/folder');
    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({
      addItem,
      setSectionSubmenu: vi.fn()
    });

    fileMenuHandlers[0]?.(menu, folder, 'file-explorer-context-menu');

    expect(addItem).toHaveBeenCalledOnce();
  });

  it('should always allow executing for a folder', () => {
    const folder = createFolder('some/folder');
    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({
      addItem,
      setSectionSubmenu: vi.fn()
    });

    fileMenuHandlers[0]?.(menu, folder, 'file-explorer-context-menu');

    // The item is only added when both shouldAddToFolderMenu and canExecuteFolder return true.
    expect(addItem).toHaveBeenCalledOnce();
  });

  it('should convert links in the folder on executeFolder', async () => {
    const folder = createFolder('some/folder');
    const menu = strictProxy<MenuOriginal>({ setSectionSubmenu: vi.fn() });
    const addItem = vi.fn((callback: (item: unknown) => void) => {
      const item = {
        onClick: vi.fn((clickCallback: () => void) => {
          clickCallback();
          return item;
        }),
        setIcon: vi.fn().mockReturnThis(),
        setSection: vi.fn().mockReturnThis(),
        setTitle: vi.fn().mockReturnThis()
      };
      callback(item);
      return menu;
    });
    Object.assign(menu, { addItem });

    fileMenuHandlers[0]?.(menu, folder, 'file-explorer-context-menu');

    await vi.waitFor(() => {
      expect(convertLinksInFolder).toHaveBeenCalledExactlyOnceWith({ folder });
    });
  });

  function createFolder(path: string): TFolderOriginal {
    return TFolder.create__(castTo(app.vault), path).asOriginalType2__();
  }
});
