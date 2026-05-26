import type { LinkChangeUpdate } from '@obsidian-typings/obsidian-public-latest';
import type {
  ReferenceCache,
  TFile,
  TFolder
} from 'obsidian';

import { SilentError } from 'obsidian-dev-utils/error';
import { applyFileChanges } from 'obsidian-dev-utils/obsidian/file-change';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';
import {
  generateMarkdownLink,
  updateLinksInFile
} from 'obsidian-dev-utils/obsidian/link';
import { loop } from 'obsidian-dev-utils/obsidian/loop';
import { confirm } from 'obsidian-dev-utils/obsidian/modals/confirm';
import { addToQueue } from 'obsidian-dev-utils/obsidian/queue';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { Plugin } from './plugin.ts';

import {
  applyLinkChangeUpdates,
  convertLinksInCurrentFile,
  convertLinksInFile,
  convertLinksInFolder,
  fixChange
} from './link-converter.ts';
import { PluginSettings } from './plugin-settings.ts';

vi.mock('obsidian-dev-utils/obsidian/file-change', () => ({
  applyFileChanges: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('obsidian-dev-utils/obsidian/file-system', () => ({
  getMarkdownFiles: vi.fn().mockReturnValue([]),
  isMarkdownFile: vi.fn().mockReturnValue(true)
}));

vi.mock('obsidian-dev-utils/obsidian/link', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian-dev-utils/obsidian/link')>();
  return {
    ...actual,
    generateMarkdownLink: vi.fn().mockReturnValue('[alias](target.md)'),
    splitSubpath: vi.fn().mockReturnValue({ linkPath: 'target.md', subpath: '' }),
    updateLinksInFile: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('obsidian-dev-utils/obsidian/loop', () => ({
  loop: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('obsidian-dev-utils/obsidian/modals/confirm', () => ({
  confirm: vi.fn().mockResolvedValue(false)
}));

vi.mock('obsidian-dev-utils/obsidian/queue', () => ({
  addToQueue: vi.fn()
}));

vi.mock('obsidian-dev-utils/error', () => {
  class SilentErrorMock extends Error {
    public constructor(message?: string) {
      super(message);
      this.name = 'SilentError';
    }
  }
  return { SilentError: SilentErrorMock };
});

vi.mock('obsidian-dev-utils/async', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian-dev-utils/async')>();
  return {
    ...actual,
    handleSilentError: vi.fn().mockImplementation((error: unknown) => {
      return error instanceof Error && error.name === 'SilentError';
    })
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function createMockFile(path: string): TFile {
  return strictProxy<TFile>({ path });
}

function createMockPlugin(settingsOverrides?: Partial<PluginSettings>): Plugin {
  const settings = new PluginSettings();
  if (settingsOverrides) {
    Object.assign(settings, settingsOverrides);
  }

  return strictProxy<Plugin>({
    abortSignal: new AbortController().signal,
    app: {
      fileManager: {},
      isMobile: false,
      metadataCache: {
        getFirstLinkpathDest: vi.fn().mockReturnValue(null)
      },
      vault: {
        getRoot: vi.fn().mockReturnValue(strictProxy<TFolder>({ path: '/' }))
      },
      workspace: {
        getActiveFile: vi.fn().mockReturnValue(null)
      }
    },
    pluginSettingsComponent: {
      settings
    },
    processFileAbortControllers: new Map<string, AbortController>()
  });
}

describe('fixChange', () => {
  it('should return unchanged value when change does not match the bug pattern', () => {
    const plugin = createMockPlugin();
    const file = createMockFile('source.md');

    const result = fixChange(plugin, '[alias](target.md)', file);

    expect(result).toBe('[alias](target.md)');
  });

  it('should fix broken angle bracket link when target file is not found', () => {
    const plugin = createMockPlugin();
    const file = createMockFile('source.md');

    const result = fixChange(plugin, '[alias](path/to/file.md something>)', file);

    expect(result).toBe('[alias](path/to/file.md)');
  });

  it('should fix broken angle bracket embed link when target file is not found', () => {
    const plugin = createMockPlugin();
    const file = createMockFile('source.md');

    const result = fixChange(plugin, '![alias](path/to/file.md something>)', file);

    expect(result).toBe('![alias](path/to/file.md)');
  });

  it('should regenerate link when target file is found', () => {
    vi.mocked(generateMarkdownLink).mockReturnValue('[alias](correct-path.md)');

    const plugin = createMockPlugin();
    const targetFile = createMockFile('target.md');
    vi.mocked(plugin.app.metadataCache.getFirstLinkpathDest).mockReturnValue(targetFile);
    const file = createMockFile('source.md');

    const result = fixChange(plugin, '[alias](target.md something>)', file);

    expect(result).toBe('[alias](correct-path.md)');
    expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(generateMarkdownLink).mock.calls[0]?.[0];
    expect(callArgs).toHaveProperty('alias', 'alias');
    expect(callArgs).toHaveProperty('isEmbed', false);
  });

  it('should set isEmbed to true for embed links', () => {
    vi.mocked(generateMarkdownLink).mockReturnValue('![alias](correct-path.md)');

    const plugin = createMockPlugin();
    const targetFile = createMockFile('target.md');
    vi.mocked(plugin.app.metadataCache.getFirstLinkpathDest).mockReturnValue(targetFile);
    const file = createMockFile('source.md');

    fixChange(plugin, '![alias](target.md something>)', file);

    expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledWith(expect.objectContaining({
      isEmbed: true
    }));
  });
});

describe('convertLinksInCurrentFile', () => {
  it('should return false when no active file', () => {
    const plugin = createMockPlugin();

    const result = convertLinksInCurrentFile(plugin, false);

    expect(result).toBe(false);
  });

  it('should return false when active file is not markdown', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);

    const plugin = createMockPlugin();
    const file = createMockFile('test.txt');
    vi.mocked(plugin.app.workspace.getActiveFile).mockReturnValue(file);

    const result = convertLinksInCurrentFile(plugin, false);

    expect(result).toBe(false);
  });

  it('should return true when checking and active file is markdown', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);

    const plugin = createMockPlugin();
    const file = createMockFile('test.md');
    vi.mocked(plugin.app.workspace.getActiveFile).mockReturnValue(file);

    const result = convertLinksInCurrentFile(plugin, true);

    expect(result).toBe(true);
  });

  it('should add to queue when not checking and active file is markdown', () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);

    const plugin = createMockPlugin();
    const file = createMockFile('test.md');
    vi.mocked(plugin.app.workspace.getActiveFile).mockReturnValue(file);

    convertLinksInCurrentFile(plugin, false);

    expect(vi.mocked(addToQueue)).toHaveBeenCalledWith(expect.objectContaining({
      operationName: 'convertLinksInCurrentFile'
    }));
  });

  it('should invoke the queue operationFn that calls convertLinksInFile', async () => {
    vi.mocked(isMarkdownFile).mockReturnValue(true);

    const plugin = createMockPlugin();
    const file = createMockFile('test.md');
    vi.mocked(plugin.app.workspace.getActiveFile).mockReturnValue(file);

    convertLinksInCurrentFile(plugin, false);

    const mockedAddToQueue = vi.mocked(addToQueue);
    const queueCall = mockedAddToQueue.mock.calls[0]?.[0];
    const operationFn = queueCall?.operationFn;
    await operationFn?.(new AbortController().signal);

    expect(vi.mocked(updateLinksInFile)).toHaveBeenCalledOnce();
  });
});

describe('convertLinksInFile', () => {
  it('should return early when path is ignored and no prompt requested', async () => {
    const plugin = createMockPlugin();
    const file = createMockFile('test.excalidraw.md');

    await convertLinksInFile(plugin, file, new AbortController().signal);

    expect(vi.mocked(updateLinksInFile)).not.toHaveBeenCalled();
  });

  it('should prompt and return when user declines conversion of excluded file', async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    const plugin = createMockPlugin();
    const file = createMockFile('test.excalidraw.md');

    await convertLinksInFile(plugin, file, new AbortController().signal, true);

    expect(vi.mocked(confirm)).toHaveBeenCalled();
    expect(vi.mocked(updateLinksInFile)).not.toHaveBeenCalled();
  });

  it('should convert when user confirms conversion of excluded file', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const plugin = createMockPlugin();
    const file = createMockFile('test.excalidraw.md');

    await convertLinksInFile(plugin, file, new AbortController().signal, true);

    expect(vi.mocked(updateLinksInFile)).toHaveBeenCalled();
  });

  it('should convert links in non-ignored file', async () => {
    const plugin = createMockPlugin();
    const file = createMockFile('notes/regular.md');

    await convertLinksInFile(plugin, file, new AbortController().signal);

    expect(vi.mocked(updateLinksInFile)).toHaveBeenCalledOnce();
  });

  it('should throw when abort signal is already aborted', async () => {
    const plugin = createMockPlugin();
    const file = createMockFile('notes/regular.md');
    const controller = new AbortController();
    controller.abort();

    await expect(convertLinksInFile(plugin, file, controller.signal)).rejects.toThrow();
  });
});

describe('convertLinksInFolder', () => {
  it('should call loop with correct parameters', async () => {
    const plugin = createMockPlugin();
    const folder = strictProxy<TFolder>({ path: 'some/folder' });

    await convertLinksInFolder(plugin, folder, new AbortController().signal);

    expect(vi.mocked(loop)).toHaveBeenCalledWith(expect.objectContaining({
      shouldContinueOnError: true,
      shouldShowProgressBar: true
    }));
  });

  it('should use vault root message for root folder', async () => {
    const plugin = createMockPlugin();
    const folder = strictProxy<TFolder>({ path: '/' });

    await convertLinksInFolder(plugin, folder, new AbortController().signal);

    expect(vi.mocked(loop)).toHaveBeenCalledWith(expect.objectContaining({
      progressBarTitle: 'Better Markdown Links: Converting links in entire vault...'
    }));
  });

  it('should use folder-specific message for non-root folder', async () => {
    const plugin = createMockPlugin();
    const folder = strictProxy<TFolder>({ path: 'subfolder' });

    await convertLinksInFolder(plugin, folder, new AbortController().signal);

    expect(vi.mocked(loop)).toHaveBeenCalledWith(expect.objectContaining({
      progressBarTitle: 'Better Markdown Links: Converting links in folder "subfolder" ...'
    }));
  });

  it('should invoke buildNoticeMessage callback', async () => {
    const plugin = createMockPlugin();
    const folder = strictProxy<TFolder>({ path: '/' });

    await convertLinksInFolder(plugin, folder, new AbortController().signal);

    const mockedLoop = vi.mocked(loop);
    const loopCall = mockedLoop.mock.calls[0]?.[0];
    const message = loopCall?.buildNoticeMessage(createMockFile('test.md'), '1/5');

    expect(message).toBe('Converting links in note 1/5 - test.md');
  });

  it('should invoke processItem callback', async () => {
    const plugin = createMockPlugin();
    const folder = strictProxy<TFolder>({ path: '/' });

    await convertLinksInFolder(plugin, folder, new AbortController().signal);

    const mockedLoop = vi.mocked(loop);
    const loopCall = mockedLoop.mock.calls[0]?.[0];
    const file = createMockFile('test.md');
    await loopCall?.processItem(file);

    expect(vi.mocked(updateLinksInFile)).toHaveBeenCalled();
  });
});

describe('applyLinkChangeUpdates', () => {
  it('should abort previous processing of same file', async () => {
    const plugin = createMockPlugin();
    const file = createMockFile('test.md');
    const existingController = new AbortController();
    plugin.processFileAbortControllers.set('test.md', existingController);

    await applyLinkChangeUpdates(plugin, file, []);

    expect(existingController.signal.aborted).toBe(true);
  });

  it('should apply file changes with fixed updates', async () => {
    const plugin = createMockPlugin();
    const file = createMockFile('test.md');
    const updates: LinkChangeUpdate[] = [
      {
        change: '[alias](target.md)',
        reference: strictProxy<ReferenceCache>({
          original: '[[target]]'
        }),
        sourcePath: 'source.md'
      }
    ];

    await applyLinkChangeUpdates(plugin, file, updates);

    expect(vi.mocked(applyFileChanges)).toHaveBeenCalled();
  });

  it('should invoke the file changes callback to map updates', async () => {
    const plugin = createMockPlugin();
    const file = createMockFile('test.md');
    const reference = strictProxy<ReferenceCache>({ original: '[[target]]' });
    const updates: LinkChangeUpdate[] = [
      {
        change: '[alias](target.md)',
        reference,
        sourcePath: 'source.md'
      }
    ];

    await applyLinkChangeUpdates(plugin, file, updates);

    const mockedApplyFileChanges = vi.mocked(applyFileChanges);
    const changesFn = mockedApplyFileChanges.mock.calls[0]?.[2] as (() => unknown[]) | undefined;
    const changes = changesFn?.();

    expect(changes).toHaveLength(1);
    expect(changes?.[0]).toEqual(expect.objectContaining({
      newContent: '[alias](target.md)',
      oldContent: '[[target]]'
    }));
  });

  it('should silently handle errors from applyFileChanges', async () => {
    vi.mocked(applyFileChanges).mockRejectedValue(new SilentError('test'));
    const plugin = createMockPlugin();
    const file = createMockFile('test.md');

    await expect(applyLinkChangeUpdates(plugin, file, [])).resolves.toBeUndefined();
  });

  it('should rethrow non-silent errors from applyFileChanges', async () => {
    vi.mocked(applyFileChanges).mockRejectedValue(new Error('real error'));
    const plugin = createMockPlugin();
    const file = createMockFile('test.md');

    await expect(applyLinkChangeUpdates(plugin, file, [])).rejects.toThrow('real error');
  });
});
