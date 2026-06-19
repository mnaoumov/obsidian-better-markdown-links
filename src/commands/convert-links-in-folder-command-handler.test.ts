import type { TFolder } from 'obsidian';

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

const { mockBaseExecute } = vi.hoisted(() => ({
  mockBaseExecute: vi.fn<() => Promise<void>>()
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/folder-command-handler', () => ({
  FolderCommandHandler: class {
    protected async execute(): Promise<void> {
      await mockBaseExecute();
    }
  }
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { ConvertLinksInFolderCommandHandler } from './convert-links-in-folder-command-handler.ts';

interface CommandHandlerPrivate {
  canExecuteFolder(): boolean;
  executeFolder(folder: TFolder): Promise<void>;
  shouldAddToFolderMenu(): boolean;
}

function asPrivate(handler: ConvertLinksInFolderCommandHandler): CommandHandlerPrivate {
  return castTo<CommandHandlerPrivate>(handler);
}

describe('ConvertLinksInFolderCommandHandler', () => {
  let convertLinksInFolder: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFolder']>>;
  let handler: ConvertLinksInFolderCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseExecute.mockResolvedValue(undefined);
    convertLinksInFolder = vi.fn<LinkConverter['convertLinksInFolder']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFolder });
    handler = new ConvertLinksInFolderCommandHandler({ linkConverter });
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinksInFolderCommandHandler);
  });

  it('should always allow executing for a folder', () => {
    expect(asPrivate(handler).canExecuteFolder()).toBe(true);
  });

  it('should always add to the folder menu', () => {
    expect(asPrivate(handler).shouldAddToFolderMenu()).toBe(true);
  });

  it('should convert links in the folder on executeFolder', async () => {
    const folder = strictProxy<TFolder>({ path: 'some/folder' });

    await asPrivate(handler).executeFolder(folder);

    expect(mockBaseExecute).toHaveBeenCalledOnce();
    expect(convertLinksInFolder).toHaveBeenCalledExactlyOnceWith({ folder });
  });
});
