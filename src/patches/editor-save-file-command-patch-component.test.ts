import type {
  App,
  Command,
  TFile
} from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { BetterMarkdownLinksComponent } from '../better-markdown-links-component.ts';

import { EditorSaveFileCommandPatchComponent } from './editor-save-file-command-patch-component.ts';

interface CreateComponentOptions {
  readonly activeFile?: null | TFile;
  readonly isCommandRegistered?: boolean;
}

interface TestContext {
  command: Command;
  component: EditorSaveFileCommandPatchComponent;
  findCommand: ReturnType<typeof vi.fn>;
  markSaveCommand: ReturnType<typeof vi.fn>;
}

const loadedComponents: EditorSaveFileCommandPatchComponent[] = [];

function createCommand(): Command {
  return castTo<Command>({
    checkCallback: vi.fn((checking: boolean): boolean => !checking),
    id: 'editor:save-file',
    name: 'Save current file'
  });
}

function createContext(options?: CreateComponentOptions): TestContext {
  const command = createCommand();
  const isCommandRegistered = options?.isCommandRegistered ?? true;
  const findCommand = vi.fn().mockReturnValue(isCommandRegistered ? command : undefined);
  const activeFile = options?.activeFile === undefined ? makeTFile('note.md') : options.activeFile;
  const getActiveFile = vi.fn().mockReturnValue(activeFile);
  const app = strictProxy<App>({
    commands: strictProxy<App['commands']>({ findCommand }),
    workspace: strictProxy<App['workspace']>({ getActiveFile })
  });
  const markSaveCommand = vi.fn<BetterMarkdownLinksComponent['markSaveCommand']>();
  const betterMarkdownLinksComponent = strictProxy<BetterMarkdownLinksComponent>({ markSaveCommand });

  const component = new EditorSaveFileCommandPatchComponent({
    app,
    betterMarkdownLinksComponent
  });
  loadedComponents.push(component);
  component.load();

  return {
    command,
    component,
    findCommand,
    markSaveCommand
  };
}

function invokeCheckCallback(command: Command, checking: boolean): boolean {
  return castTo<(checking: boolean) => boolean>(command.checkCallback)(checking);
}

function makeTFile(path: string): TFile {
  return strictProxy<TFile>({ path });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  while (loadedComponents.length > 0) {
    loadedComponents.pop()?.unload();
  }
});

describe('EditorSaveFileCommandPatchComponent', () => {
  it('should tag the active file as a save command when performing the command', () => {
    const context = createContext();

    const result = invokeCheckCallback(context.command, false);

    expect(context.markSaveCommand).toHaveBeenCalledExactlyOnceWith('note.md');
    expect(result).toBe(true);
  });

  it('should not tag anything while only checking command availability', () => {
    const context = createContext();

    const result = invokeCheckCallback(context.command, true);

    expect(context.markSaveCommand).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('should not tag anything when there is no active file', () => {
    const context = createContext({ activeFile: null });

    invokeCheckCallback(context.command, false);

    expect(context.markSaveCommand).not.toHaveBeenCalled();
  });

  it('should do nothing when the save-file command is not registered', () => {
    const context = createContext({ isCommandRegistered: false });

    expect(context.findCommand).toHaveBeenCalledWith('editor:save-file');
    expect(context.markSaveCommand).not.toHaveBeenCalled();
  });
});
