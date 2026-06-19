import type {
  App,
  CachedMetadata,
  Reference,
  TAbstractFile,
  TFile
} from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { ConsoleDebugComponent } from 'obsidian-dev-utils/obsidian/components/console-debug-component';
import type { GenerateMarkdownLinkParams } from 'obsidian-dev-utils/obsidian/link';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  App as AppCls,
  TFile as TFileCls,
  TFolder as TFolderCls
} from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { LinkConverter } from './link-converter.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { PluginSettings } from './plugin-settings.ts';

interface DefaultParamsComponentParams {
  getDefaultParams(): Partial<GenerateMarkdownLinkParams>;
}

type PatchHandler = (params: PatchHandlerParams) => Promise<void>;

interface PatchHandlerParams {
  fallback(): Promise<void>;
  readonly originalArgs: readonly unknown[];
}

interface RegisterMethodPatchParams {
  readonly patchHandler: PatchHandler;
}

const {
  capturedGetDefaultParams,
  capturedPatchHandlers
} = vi.hoisted(() => ({
  capturedGetDefaultParams: [] as (() => Partial<GenerateMarkdownLinkParams>)[],
  capturedPatchHandlers: [] as PatchHandler[]
}));

vi.mock('obsidian-dev-utils/abort-controller', () => ({
  abortSignalAny: vi.fn()
}));

vi.mock('obsidian-dev-utils/async', () => ({
  convertAsyncToSync: vi.fn((fn: unknown) => fn),
  handleSilentError: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/link', () => ({
  convertLink: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/metadata-cache', () => ({
  getAllLinks: vi.fn(),
  getCacheSafe: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/components/layout-ready-component', () => ({
  LayoutReadyComponent: class {
    protected app: App;
    public constructor(app: App) {
      this.app = app;
    }

    public addChild(child: unknown): unknown {
      return child;
    }

    public registerEvent(_ref: unknown): void {
      // Base no-op.
    }
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/monkey-around-component', () => ({
  MonkeyAroundComponent: class {
    public registerMethodPatch(params: RegisterMethodPatchParams): void {
      capturedPatchHandlers.push(params.patchHandler);
    }
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/generate-markdown-link-default-params-component', () => ({
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Mock component that only captures its constructor params.
  GenerateMarkdownLinkDefaultParamsComponent: class {
    public constructor(params: DefaultParamsComponentParams) {
      capturedGetDefaultParams.push(params.getDefaultParams);
    }
  }
}));

vi.mock('./generate-markdown-link-extended-impl.ts', () => ({
  GenerateMarkdownLinkPatchComponent: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { handleSilentError } from 'obsidian-dev-utils/async';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { convertLink } from 'obsidian-dev-utils/obsidian/link';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/metadata-cache';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { BetterMarkdownLinksComponent } from './better-markdown-links-component.ts';

interface ComponentInternals {
  handleModify(file: TAbstractFile): Promise<void>;
  onLayoutReady(): void;
  processFileAbortControllers: Map<string, AbortController>;
}

interface MutableAbortSignalHolder {
  abortSignal: AbortSignal;
}

interface MutableAutoConvertSetting {
  shouldAutomaticallyConvertNewLinks: boolean;
}

interface TestContext {
  abortSignalComponent: AbortSignalComponent;
  app: App;
  component: BetterMarkdownLinksComponent;
  consoleDebug: ReturnType<typeof vi.fn>;
  convertLinksInFile: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFile']>>;
  getFileByPath: ReturnType<typeof vi.fn>;
  isPathIgnored: ReturnType<typeof vi.fn>;
  settings: PluginSettings;
}

const realVault = AppCls.createConfigured__().vault;

function asInternals(component: BetterMarkdownLinksComponent): ComponentInternals {
  return castTo<ComponentInternals>(component);
}

function createContext(): TestContext {
  const abortSignalComponent = strictProxy<AbortSignalComponent>({
    abortSignal: new AbortController().signal
  });
  const consoleDebug = vi.fn();
  const consoleDebugComponent = strictProxy<ConsoleDebugComponent>({ consoleDebug });
  const getFileByPath = vi.fn();
  const app = strictProxy<App>({
    vault: {
      getFileByPath,
      on: vi.fn().mockReturnValue({})
    }
  });
  const isPathIgnored = vi.fn<(path: string) => boolean>().mockReturnValue(false);
  const settings = strictProxy<PluginSettings>({
    getLinkStyle: vi.fn().mockReturnValue('ObsidianSettingsDefault'),
    isPathIgnored,
    shouldAutomaticallyConvertNewLinks: true
  });
  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({ settings });
  const convertLinksInFile = vi.fn<LinkConverter['convertLinksInFile']>().mockResolvedValue(undefined);
  const linkConverter = strictProxy<LinkConverter>({ convertLinksInFile });

  const component = new BetterMarkdownLinksComponent({
    abortSignalComponent,
    app,
    consoleDebugComponent,
    linkConverter,
    pluginSettingsComponent
  });

  return {
    abortSignalComponent,
    app,
    component,
    consoleDebug,
    convertLinksInFile,
    getFileByPath,
    isPathIgnored,
    settings
  };
}

function makeLink(original: string): Reference {
  return castTo<Reference>({ original });
}

function makeTFile(path: string): TFile {
  return castTo<TFile>(TFileCls.create__(realVault, path));
}

function makeTFolder(path: string): TAbstractFile {
  return castTo<TAbstractFile>(TFolderCls.create__(realVault, path));
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedGetDefaultParams.length = 0;
  capturedPatchHandlers.length = 0;
  activeDocument.body.innerHTML = '';
  vi.mocked(abortSignalAny).mockImplementation((...signals) => signals[0] ?? new AbortController().signal);
  vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({}));
  vi.mocked(getAllLinks).mockReturnValue([]);
  vi.mocked(convertLink).mockReturnValue('converted');
  vi.mocked(handleSilentError).mockReturnValue(false);
});

describe('BetterMarkdownLinksComponent', () => {
  describe('onLayoutReady', () => {
    it('should wire up the default params component and event registration', () => {
      const context = createContext();

      asInternals(context.component).onLayoutReady();

      expect(context.app.vault.on).toHaveBeenCalledWith('modify', expect.any(Function));
      expect(capturedPatchHandlers.length).toBe(1);
    });

    it('should expose the plugin settings as default link generation params', () => {
      const context = createContext();

      asInternals(context.component).onLayoutReady();

      const getDefaultParams = capturedGetDefaultParams[0];
      expect(getDefaultParams?.()).toBe(context.settings);
    });
  });

  describe('handleModify', () => {
    it('should throw when the plugin abort signal is already aborted', async () => {
      const context = createContext();
      const controller = new AbortController();
      controller.abort();
      castTo<MutableAbortSignalHolder>(context.abortSignalComponent).abortSignal = controller.signal;

      await expect(asInternals(context.component).handleModify(makeTFile('note.md'))).rejects.toThrow();
    });

    it('should ignore non-file abstract files', async () => {
      const context = createContext();

      await asInternals(context.component).handleModify(makeTFolder('folder'));

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should abort an in-progress conversion for the same file', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      const existingController = new AbortController();
      const abortSpy = vi.spyOn(existingController, 'abort');
      asInternals(context.component).processFileAbortControllers.set(file.path, existingController);

      await asInternals(context.component).handleModify(file);

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should do nothing when automatic conversion is disabled', async () => {
      const context = createContext();
      castTo<MutableAutoConvertSetting>(context.settings).shouldAutomaticallyConvertNewLinks = false;

      await asInternals(context.component).handleModify(makeTFile('note.md'));

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should do nothing while the suggestion container is shown', async () => {
      const context = createContext();
      const suggestionContainer = activeDocument.createElement('div');
      suggestionContainer.addClass('suggestion-container');
      activeDocument.body.appendChild(suggestionContainer);
      vi.spyOn(suggestionContainer, 'isShown').mockReturnValue(true);

      await asInternals(context.component).handleModify(makeTFile('note.md'));

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should skip and log ignored files', async () => {
      const context = createContext();
      context.isPathIgnored.mockReturnValue(true);

      await asInternals(context.component).handleModify(makeTFile('ignored.md'));

      expect(context.consoleDebug).toHaveBeenCalledWith('File ignored.md is ignored in plugin settings, skipping');
      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should throw when the combined abort signal aborts after reading the cache', async () => {
      const context = createContext();
      const controller = new AbortController();
      controller.abort();
      vi.mocked(abortSignalAny).mockReturnValue(controller.signal);

      await expect(asInternals(context.component).handleModify(makeTFile('note.md'))).rejects.toThrow();
    });

    it('should return when there is no cache', async () => {
      const context = createContext();
      vi.mocked(getCacheSafe).mockResolvedValue(null);

      await asInternals(context.component).handleModify(makeTFile('note.md'));

      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should not convert when all links already match the target style', async () => {
      const context = createContext();
      vi.mocked(getAllLinks).mockReturnValue([makeLink('converted')]);

      await asInternals(context.component).handleModify(makeTFile('note.md'));

      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should convert when a link differs from the target style', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getAllLinks).mockReturnValue([makeLink('[[different]]')]);

      await asInternals(context.component).handleModify(file);

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
      expect(context.convertLinksInFile.mock.calls[0]?.[0].file).toBe(file);
      expect(asInternals(context.component).processFileAbortControllers.has(file.path)).toBe(false);
    });
  });

  describe('openLinkText patch', () => {
    function getPatchHandler(context: TestContext): PatchHandler {
      asInternals(context.component).onLayoutReady();
      const handler = capturedPatchHandlers[0];
      if (!handler) {
        throw new Error('Patch handler was not registered');
      }
      return handler;
    }

    it('should call the fallback and skip processing when the source file is missing', async () => {
      const context = createContext();
      context.getFileByPath.mockReturnValue(null);
      const handler = getPatchHandler(context);
      const fallback = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const handleModifySpy = vi.spyOn(asInternals(context.component), 'handleModify');

      await handler({ fallback, originalArgs: ['link', 'missing.md'] });

      expect(fallback).toHaveBeenCalledOnce();
      expect(handleModifySpy).not.toHaveBeenCalled();
    });

    it('should process the source file after the fallback', async () => {
      const context = createContext();
      const sourceFile = makeTFile('source.md');
      context.getFileByPath.mockReturnValue(sourceFile);
      const handler = getPatchHandler(context);
      const handleModifySpy = vi.spyOn(asInternals(context.component), 'handleModify').mockResolvedValue(undefined);

      await handler({ fallback: vi.fn().mockResolvedValue(undefined), originalArgs: ['link', 'source.md'] });

      expect(handleModifySpy).toHaveBeenCalledWith(sourceFile);
    });

    it('should swallow silent errors thrown while processing', async () => {
      const context = createContext();
      context.getFileByPath.mockReturnValue(makeTFile('source.md'));
      const handler = getPatchHandler(context);
      vi.spyOn(asInternals(context.component), 'handleModify').mockRejectedValue(new Error('silent'));
      vi.mocked(handleSilentError).mockReturnValue(true);

      await expect(handler({ fallback: vi.fn().mockResolvedValue(undefined), originalArgs: ['link', 'source.md'] }))
        .resolves.toBeUndefined();
    });

    it('should rethrow non-silent errors thrown while processing', async () => {
      const context = createContext();
      context.getFileByPath.mockReturnValue(makeTFile('source.md'));
      const handler = getPatchHandler(context);
      const error = new Error('boom');
      vi.spyOn(asInternals(context.component), 'handleModify').mockRejectedValue(error);
      vi.mocked(handleSilentError).mockReturnValue(false);

      await expect(handler({ fallback: vi.fn().mockResolvedValue(undefined), originalArgs: ['link', 'source.md'] }))
        .rejects.toThrow('boom');
    });
  });
});
