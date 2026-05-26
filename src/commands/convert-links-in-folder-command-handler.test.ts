import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/folder-command-handler';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { Plugin } from '../plugin.ts';

import { convertLinksInFolder } from '../link-converter.ts';
import { ConvertLinksInFolderCommandHandler } from './convert-links-in-folder-command-handler.ts';

vi.mock('../link-converter.ts', () => ({
  convertLinksInFolder: vi.fn().mockResolvedValue(undefined)
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockPlugin(): Plugin {
  return strictProxy<Plugin>({
    abortSignal: new AbortController().signal,
    app: {
      workspace: {
        getActiveFile: vi.fn().mockReturnValue(null)
      }
    }
  });
}

describe('ConvertLinksInFolderCommandHandler', () => {
  it('should create handler with correct id and name', () => {
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFolderCommandHandler(plugin);

    expect(handler.id).toBe('convert-links-in-current-folder');
    expect(handler.name).toBe('Convert links in current folder');
  });

  it('should always allow execution for folders', () => {
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFolderCommandHandler(plugin);

    expect(handler['canExecuteFolder']()).toBe(true);
  });

  it('should call convertLinksInFolder on executeFolder', async () => {
    // @ts-expect-error -- spying on protected method not visible in public type
    vi.spyOn(FolderCommandHandler.prototype, 'execute').mockResolvedValue(undefined);
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFolderCommandHandler(plugin);
    const folder = strictProxy<TFolder>({ path: 'test-folder' });

    await handler['executeFolder'](folder);

    expect(vi.mocked(convertLinksInFolder)).toHaveBeenCalledOnce();
  });

  it('should always show in folder menu', () => {
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFolderCommandHandler(plugin);

    expect(handler['shouldAddToFolderMenu']()).toBe(true);
  });
});
