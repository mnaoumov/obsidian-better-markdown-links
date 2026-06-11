import type { TFile } from 'obsidian';

import { FileCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/file-command-handler';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { Plugin } from '../plugin.ts';

import { convertLinksInFile } from '../link-converter.ts';
import { ConvertLinksInFileCommandHandler } from './convert-links-in-file-command-handler.ts';

vi.mock('../link-converter.ts', () => ({
  convertLinksInFile: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('obsidian-dev-utils/obsidian/file-system', () => ({
  isMarkdownFile: vi.fn().mockReturnValue(true)
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockFile(path: string): TFile {
  return strictProxy<TFile>({ path });
}

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

describe('ConvertLinksInFileCommandHandler', () => {
  it('should create handler with correct id and name', () => {
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFileCommandHandler(plugin);

    expect(handler.id).toBe('convert-links-in-current-file');
    expect(handler.name).toBe('Convert links in current file');
  });

  it('should not execute for non-markdown files', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    // @ts-expect-error -- spying on protected method not visible in public type
    vi.spyOn(FileCommandHandler.prototype, 'canExecute').mockReturnValue(false);
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFileCommandHandler(plugin);
    const file = createMockFile('test.txt');

    const result = handler['canExecuteFile'](file);

    expect(result).toBe(false);
  });

  it('should execute for markdown files when base canExecute returns true', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    // @ts-expect-error -- spying on protected method not visible in public type
    vi.spyOn(FileCommandHandler.prototype, 'canExecute').mockReturnValue(true);
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFileCommandHandler(plugin);
    const file = createMockFile('test.md');

    const result = handler['canExecuteFile'](file);

    expect(result).toBe(true);
  });

  it('should call convertLinksInFile on executeFile', async () => {
    // @ts-expect-error -- spying on protected method not visible in public type
    vi.spyOn(FileCommandHandler.prototype, 'execute').mockResolvedValue(undefined);
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFileCommandHandler(plugin);
    const file = createMockFile('test.md');

    await handler['executeFile'](file);

    expect(vi.mocked(convertLinksInFile)).toHaveBeenCalledOnce();
  });

  it('should show in file menu for markdown files', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFileCommandHandler(plugin);
    const file = createMockFile('test.md');

    const result = handler['shouldAddToFileMenu'](file);

    expect(result).toBe(true);
  });

  it('should not show in file menu for non-markdown files', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInFileCommandHandler(plugin);
    const file = createMockFile('test.png');

    const result = handler['shouldAddToFileMenu'](file);

    expect(result).toBe(false);
  });
});
