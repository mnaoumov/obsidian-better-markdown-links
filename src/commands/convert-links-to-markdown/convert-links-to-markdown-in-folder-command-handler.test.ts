import type { ActiveFileProvider } from '@mnaoumov/obsidian-lib/active-file-provider';
import type {
  CommandHandler,
  CommandHandlerRegistrationContext
} from '@mnaoumov/obsidian-lib/command-handlers/command-handler';
import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type {
  FileMenuEventHandler,
  FilesMenuEventHandler,
  MarkdownViewportMenuEventHandler
} from '@mnaoumov/obsidian-lib/menu-event-registrar';
import type { DisposableEx } from '@mnaoumov/typescript-lib/disposable';
import type {
  App as AppOriginal,
  Menu as MenuOriginal,
  TFolder as TFolderOriginal
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
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

import type { LinkConverter } from '../../conversion/link-converter.ts';

import { ConvertLinksToMarkdownInFolderCommandHandler } from './convert-links-to-markdown-in-folder-command-handler.ts';

let app: AppOriginal;

describe('ConvertLinksToMarkdownInFolderCommandHandler', () => {
  let activeFolder: TFolderOriginal;
  let convertLinksInFolder: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFolder']>>;
  let fileMenuHandlers: FileMenuEventHandler[];
  let handler: ConvertLinksToMarkdownInFolderCommandHandler;
  let runBulkOperation: ReturnType<typeof vi.fn<BulkOperationCommitComponent['runBulkOperation']>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = App.createConfigured__({ files: { 'some/folder/note.md': '' } }).asOriginalType__();
    convertLinksInFolder = vi.fn<LinkConverter['convertLinksInFolder']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFolder });
    runBulkOperation = vi.fn<BulkOperationCommitComponent['runBulkOperation']>(async (params) => await params.operation());
    const bulkOperationCommitComponent = strictProxy<BulkOperationCommitComponent>({ runBulkOperation: castTo(runBulkOperation) });
    handler = new ConvertLinksToMarkdownInFolderCommandHandler({ bulkOperationCommitComponent, linkConverter });

    fileMenuHandlers = [];
    // The palette command resolves the folder from the active file's parent, so the provider has to hand
    // back a file that has one.
    activeFolder = ensureNonNullable(app.vault.getFolderByPath('some/folder'));
    const activeFileProvider: ActiveFileProvider = {
      getActiveFile: () => app.vault.getFileByPath('some/folder/note.md')
    };
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider,
      menuEventRegistrar: {
        registerEditorMenuEventHandler: vi.fn(),
        registerFileMenuEventHandler: (menuHandler: FileMenuEventHandler): DisposableEx => {
          fileMenuHandlers.push(menuHandler);
          return strictProxy<DisposableEx>({});
        },
        registerFilesMenuEventHandler: (_menuHandler: FilesMenuEventHandler): DisposableEx => {
          // The handler under test does not use the multi-folder menu.
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
    expect(handler).toBeInstanceOf(ConvertLinksToMarkdownInFolderCommandHandler);
  });

  it('should force the markdown style when executed', async () => {
    handler.buildCommand().checkCallback?.(false);

    await vi.waitFor(() => {
      expect(convertLinksInFolder).toHaveBeenCalledExactlyOnceWith({
        folder: activeFolder,
        shouldForceMarkdownLinkStyle: true,
        shouldResolveUnresolvedLinks: true
      });
      expect(runBulkOperation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ summary: 'Convert links to Markdown in some/folder' }));
    });
  });

  it('should always allow executing for a folder', () => {
    expect(handler.buildCommand().checkCallback?.(true)).toBe(true);
  });

  // See the sibling file handler's test: the style-agnostic `Convert links in folder` row already owns the
  // folder menu.
  it('should stay out of the folder menu', () => {
    const folder = TFolder.create__(castTo(app.vault), 'some/folder').asOriginalType2__();
    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({
      addItem,
      setSectionSubmenu: vi.fn()
    });

    fileMenuHandlers[0]?.(menu, folder, 'file-explorer-context-menu');

    expect(addItem).not.toHaveBeenCalled();
  });
});
