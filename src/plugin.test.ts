import type {
  App,
  CachedMetadata,
  EventRef,
  PluginManifest,
  Workspace
} from 'obsidian';
import type { Mock } from 'vitest';

import {
  TAbstractFile,
  TFile as TFileCls
} from 'obsidian';
import { handleSilentError } from 'obsidian-dev-utils/async';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { CallbackLayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';
import { RenameDeleteHandlerComponent } from 'obsidian-dev-utils/obsidian/components/rename-delete-handler-component';
import { convertLink } from 'obsidian-dev-utils/obsidian/link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/metadata-cache';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { patchGenerateMarkdownLink } from './generate-markdown-link-extended-impl.ts';
import { convertLinksInFile } from './link-converter.ts';
import { PluginSettings } from './plugin-settings.ts';
import { Plugin } from './plugin.ts';

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => {
  class PluginBase {
    public app: App;
    public manifest: PluginManifest;
    public registerEvent: (_ref: EventRef) => void = vi.fn();
    protected abortSignalComponent = {
      abortSignal: new AbortController().signal
    };

    protected consoleDebugComponent = {
      consoleDebug: vi.fn()
    };

    public constructor(app: App, manifest: PluginManifest) {
      this.app = app;
      this.manifest = manifest;
    }

    public addChild<T>(child: T): T {
      return child;
    }
  }
  return { PluginBase };
});

vi.mock('obsidian-dev-utils/obsidian/data-handler', () => ({
  PluginDataHandler: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-event-source', () => ({
  PluginEventSourceImpl: vi.fn()
}));

vi.mock('./plugin-settings-component.ts', () => {
  class PluginSettingsComponent {
    public settings = new PluginSettings();
  }
  return { PluginSettingsComponent };
});

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  PluginSettingsTabComponent: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/components/layout-ready-component', () => ({
  CallbackLayoutReadyComponent: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/active-file-provider', () => ({
  AppActiveFileProvider: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/command-handler-component', () => ({
  CommandHandlerComponent: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/command-registrar', () => ({
  PluginCommandRegistrar: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/components/menu-event-registrar-component', () => ({
  MenuEventRegistrarComponent: vi.fn()
}));

type AnyFn = (...args: never[]) => unknown;
const capturedPatchFactories: Record<string, AnyFn>[] = [];
vi.mock('obsidian-dev-utils/obsidian/components/monkey-around-component', () => {
  class MonkeyAroundComponent {
    public registerPatch(_obj: unknown, factories: Record<string, AnyFn>): void {
      capturedPatchFactories.push(factories);
    }
  }
  return { MonkeyAroundComponent };
});

vi.mock('./generate-markdown-link-extended-impl.ts', () => ({
  patchGenerateMarkdownLink: vi.fn()
}));

vi.mock('./link-converter.ts', () => ({
  convertLinksInFile: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('obsidian-dev-utils/obsidian/components/rename-delete-handler-component', () => ({
  RenameDeleteHandlerComponent: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/metadata-cache', () => ({
  getAllLinks: vi.fn().mockReturnValue([]),
  getCacheSafe: vi.fn().mockResolvedValue(null)
}));

vi.mock('obsidian-dev-utils/obsidian/link', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian-dev-utils/obsidian/link')>();
  return {
    ...actual,
    convertLink: vi.fn().mockReturnValue('converted')
  };
});

vi.mock('obsidian-dev-utils/abort-controller', () => ({
  abortSignalAny: vi.fn().mockImplementation(() => {
    return new AbortController().signal;
  })
}));

vi.mock('obsidian-dev-utils/async', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian-dev-utils/async')>();
  return {
    ...actual,
    convertAsyncToSync: vi.fn().mockImplementation((fn: AnyFn) => fn),
    handleSilentError: vi.fn().mockReturnValue(false)
  };
});

vi.mock('obsidian-dev-utils/error', () => {
  class SilentError extends Error {
    public constructor(message?: string) {
      super(message);
      this.name = 'SilentError';
    }
  }
  return { SilentError };
});

vi.mock('./commands/convert-links-in-entire-vault-command-handler.ts', () => ({
  ConvertLinksInEntireVaultCommandHandler: vi.fn()
}));

vi.mock('./commands/convert-links-in-file-command-handler.ts', () => ({
  ConvertLinksInFileCommandHandler: vi.fn()
}));

vi.mock('./commands/convert-links-in-folder-command-handler.ts', () => ({
  ConvertLinksInFolderCommandHandler: vi.fn()
}));

afterEach(() => {
  vi.clearAllMocks();
  capturedPatchFactories.length = 0;
});

function createMockApp(): App {
  return strictProxy<App>({
    vault: {
      getFileByPath: vi.fn().mockReturnValue(null),
      on: vi.fn().mockReturnValue({})
    },
    workspace: {}
  });
}

function createMockManifest(): PluginManifest {
  return strictProxy<PluginManifest>({
    id: 'better-markdown-links',
    name: 'Better Markdown Links'
  });
}

function createPlugin(): Plugin {
  return new Plugin(createMockApp(), createMockManifest());
}

describe('Plugin', () => {
  describe('constructor', () => {
    it('should create plugin with settings component', () => {
      const plugin = createPlugin();

      expect(plugin.pluginSettingsComponent).toBeDefined();
      expect(plugin.pluginSettingsComponent.settings).toBeInstanceOf(PluginSettings);
    });

    it('should initialize processFileAbortControllers as empty map', () => {
      const plugin = createPlugin();

      expect(plugin.processFileAbortControllers).toBeInstanceOf(Map);
      expect(plugin.processFileAbortControllers.size).toBe(0);
    });

    it('should expose abortSignal getter', () => {
      const plugin = createPlugin();

      expect(plugin.abortSignal).toBeDefined();
    });
  });

  describe('constructor callback', () => {
    it('should pass a callback to CallbackLayoutReadyComponent that calls onLayoutReady', () => {
      createPlugin();

      const callback = vi.mocked(CallbackLayoutReadyComponent).mock.calls[0]?.[1] as (() => void) | undefined;
      callback?.();

      expect(vi.mocked(patchGenerateMarkdownLink)).toHaveBeenCalled();
    });
  });

  describe('onLayoutReady', () => {
    it('should patch generateMarkdownLink', () => {
      const plugin = createPlugin();

      plugin['onLayoutReady']();

      expect(vi.mocked(patchGenerateMarkdownLink)).toHaveBeenCalledOnce();
    });

    it('should register monkey-around patch for openLinkText', () => {
      const plugin = createPlugin();

      plugin['onLayoutReady']();

      expect(capturedPatchFactories.length).toBeGreaterThan(0);
      const factories = capturedPatchFactories[0];
      expect(factories).toHaveProperty('openLinkText');
    });

    it('should pass settingsBuilder to RenameDeleteHandlerComponent that returns correct settings', () => {
      const plugin = createPlugin();

      plugin['onLayoutReady']();

      const params = vi.mocked(RenameDeleteHandlerComponent).mock.calls[0]?.[0];
      const settings = params?.settingsBuilder();

      expect(settings?.shouldHandleRenames).toBe(plugin.pluginSettingsComponent.settings.shouldAutomaticallyUpdateLinksOnRenameOrMove);
      expect(settings?.shouldUpdateFileNameAliases).toBe(true);
    });

    it('should pass settingsBuilder with isPathIgnored that delegates to plugin settings', () => {
      const plugin = createPlugin();

      plugin['onLayoutReady']();

      const params = vi.mocked(RenameDeleteHandlerComponent).mock.calls[0]?.[0];
      const settings = params?.settingsBuilder();

      const result = settings?.isPathIgnored?.('test.excalidraw.md');

      expect(result).toBe(plugin.pluginSettingsComponent.settings.isPathIgnored('test.excalidraw.md'));
    });

    it('should create a working openLinkText wrapper via monkey-around that delegates to plugin', () => {
      const plugin = createPlugin();

      plugin['onLayoutReady']();

      const factories = capturedPatchFactories[0];
      const next = vi.fn().mockResolvedValue(undefined);
      type OpenLinkTextFn = (linkText: string, sourcePath: string) => unknown;

      const wrappedFn = castTo<OpenLinkTextFn>(factories?.['openLinkText']?.(castTo<never>(next)));

      expect(wrappedFn).toBeInstanceOf(Function);

      const workspace = {};
      const result = wrappedFn.call(workspace, 'link', 'source.md');

      expect(result).toBeDefined();
    });
  });

  describe('handleModify', () => {
    it('should return early for non-TFile instances', async () => {
      const plugin = createPlugin();
      const abstractFile = strictProxy<TAbstractFile>({ path: 'test' });

      await plugin['handleModify'](abstractFile);

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should abort previous controller for same file path', async () => {
      const plugin = createPlugin();
      const existingController = new AbortController();
      plugin.processFileAbortControllers.set('test.md', existingController);

      const file = Object.assign(Object.create(TAbstractFile.prototype), { path: 'test.md' });
      Object.setPrototypeOf(file, TFileCls.prototype);

      await plugin['handleModify'](file);

      expect(existingController.signal.aborted).toBe(true);
    });

    it('should return early when shouldAutomaticallyConvertNewLinks is false', async () => {
      const plugin = createPlugin();
      (plugin.pluginSettingsComponent.settings as PluginSettings).shouldAutomaticallyConvertNewLinks = false;

      const file = Object.create(TFileCls.prototype);
      file.path = 'test.md';

      await plugin['handleModify'](file);

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should return early when suggestion container is shown', async () => {
      const plugin = createPlugin();

      const mockDiv = activeDocument.createElement('div');
      mockDiv.isShown = vi.fn().mockReturnValue(true);
      vi.spyOn(activeDocument, 'querySelector').mockReturnValue(mockDiv);

      const file = Object.create(TFileCls.prototype);
      file.path = 'test.md';

      await plugin['handleModify'](file);

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should return early and log when path is ignored', async () => {
      const plugin = createPlugin();

      vi.spyOn(activeDocument, 'querySelector').mockReturnValue(null);

      const file = Object.create(TFileCls.prototype);
      file.path = 'test.excalidraw.md';

      await plugin['handleModify'](file);

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
      expect(plugin['consoleDebugComponent'].consoleDebug).toHaveBeenCalled();
    });

    it('should return early when cache is null', async () => {
      vi.mocked(getCacheSafe).mockResolvedValue(null);
      const plugin = createPlugin();

      vi.spyOn(activeDocument, 'querySelector').mockReturnValue(null);

      const file = Object.create(TFileCls.prototype);
      file.path = 'test.md';

      await plugin['handleModify'](file);

      expect(vi.mocked(getCacheSafe)).toHaveBeenCalled();
      expect(vi.mocked(convertLinksInFile)).not.toHaveBeenCalled();
    });

    it('should not convert when all links already match', async () => {
      vi.mocked(getCacheSafe).mockResolvedValue(strictProxy<CachedMetadata>({}));
      vi.mocked(getAllLinks).mockReturnValue([{ link: 'same', original: 'same' }]);
      vi.mocked(convertLink).mockReturnValue('same');
      const plugin = createPlugin();

      vi.spyOn(activeDocument, 'querySelector').mockReturnValue(null);

      const file = Object.create(TFileCls.prototype);
      file.path = 'test.md';

      await plugin['handleModify'](file);

      expect(vi.mocked(convertLinksInFile)).not.toHaveBeenCalled();
    });

    it('should convert when links do not match', async () => {
      vi.mocked(getCacheSafe).mockResolvedValue(strictProxy<CachedMetadata>({}));
      vi.mocked(getAllLinks).mockReturnValue([{ link: 'old-link', original: 'old-link' }]);
      vi.mocked(convertLink).mockReturnValue('new-link');
      const plugin = createPlugin();

      vi.spyOn(activeDocument, 'querySelector').mockReturnValue(null);

      const file = Object.create(TFileCls.prototype);
      file.path = 'test.md';

      await plugin['handleModify'](file);

      expect(vi.mocked(convertLinksInFile)).toHaveBeenCalledOnce();
    });

    it('should clean up processFileAbortControllers in finally block', async () => {
      vi.mocked(getCacheSafe).mockResolvedValue(null);
      const plugin = createPlugin();

      vi.spyOn(activeDocument, 'querySelector').mockReturnValue(null);

      const file = Object.create(TFileCls.prototype);
      file.path = 'test.md';

      await plugin['handleModify'](file);

      expect(plugin.processFileAbortControllers.has('test.md')).toBe(false);
    });
  });

  describe('openLinkText', () => {
    it('should call next and return when no source file found', async () => {
      const plugin = createPlugin();
      const next = vi.fn().mockResolvedValue(undefined);
      const workspace = strictProxy<Workspace>({});

      await plugin['openLinkText'](castTo<Workspace['openLinkText']>(next), workspace, 'link', 'source.md');

      expect(next).toHaveBeenCalled();
    });

    it('should call handleModify when source file exists', async () => {
      const plugin = createPlugin();
      const sourceFile = Object.create(TFileCls.prototype);
      sourceFile.path = 'source.md';
      (plugin.app.vault.getFileByPath as Mock).mockReturnValue(sourceFile);
      const next = vi.fn().mockResolvedValue(undefined);
      const workspace = strictProxy<Workspace>({});

      vi.spyOn(activeDocument, 'querySelector').mockReturnValue(null);

      await plugin['openLinkText'](castTo<Workspace['openLinkText']>(next), workspace, 'link', 'source.md');

      expect(next).toHaveBeenCalled();
    });

    it('should silently handle SilentError from handleModify', async () => {
      vi.mocked(handleSilentError).mockReturnValue(true);

      const plugin = createPlugin();
      const sourceFile = Object.create(TFileCls.prototype);
      sourceFile.path = 'source.md';
      (plugin.app.vault.getFileByPath as Mock).mockReturnValue(sourceFile);

      // Make handleModify throw
      vi.spyOn(plugin['abortSignalComponent'].abortSignal, 'throwIfAborted').mockImplementation(() => {
        throw new Error('aborted');
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const workspace = strictProxy<Workspace>({});

      await expect(plugin['openLinkText'](castTo<Workspace['openLinkText']>(next), workspace, 'link', 'source.md')).resolves.toBeUndefined();
    });

    it('should rethrow non-silent errors from handleModify', async () => {
      vi.mocked(handleSilentError).mockReturnValue(false);

      const plugin = createPlugin();
      const sourceFile = Object.create(TFileCls.prototype);
      sourceFile.path = 'source.md';
      (plugin.app.vault.getFileByPath as Mock).mockReturnValue(sourceFile);

      // Make handleModify throw
      vi.spyOn(plugin['abortSignalComponent'].abortSignal, 'throwIfAborted').mockImplementation(() => {
        throw new Error('real error');
      });

      const next = vi.fn().mockResolvedValue(undefined);
      const workspace = strictProxy<Workspace>({});

      await expect(plugin['openLinkText'](castTo<Workspace['openLinkText']>(next), workspace, 'link', 'source.md')).rejects.toThrow('real error');
    });
  });
});
