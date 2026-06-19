import type {
  App,
  PluginManifest
} from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => ({
  PluginBase: class {
    public app: App;
    public manifest: PluginManifest;
    protected abortSignalComponent = { abortSignal: new AbortController().signal };
    protected consoleDebugComponent = { consoleDebug: vi.fn() };
    public constructor(app: App, manifest: PluginManifest) {
      this.app = app;
      this.manifest = manifest;
    }

    public addChild<T>(child: T): T {
      return child;
    }
  }
}));

vi.mock('./plugin-settings-component.ts', () => {
  class PluginSettingsComponent {
    public settings = new PluginSettings();
  }
  return { PluginSettingsComponent };
});

vi.mock('obsidian-dev-utils/obsidian/components/rename-delete-handler-component', () => ({
  RenameDeleteHandlerComponent: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/command-handler-component', () => ({
  CommandHandlerComponent: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/data-handler', () => ({
  PluginDataHandler: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-event-source', () => ({
  PluginEventSourceImpl: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/active-file-provider', () => ({
  AppActiveFileProvider: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/command-registrar', () => ({
  PluginCommandRegistrar: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/components/menu-event-registrar-component', () => ({
  MenuEventRegistrarComponent: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  PluginSettingsTabComponent: vi.fn()
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

vi.mock('./link-converter.ts', () => ({
  LinkConverter: vi.fn()
}));

vi.mock('./better-markdown-links-component.ts', () => ({
  BetterMarkdownLinksComponent: vi.fn()
}));

vi.mock('./commands/convert-links-in-file-command-handler.ts', () => ({
  ConvertLinksInFileCommandHandler: vi.fn()
}));

vi.mock('./commands/convert-links-in-folder-command-handler.ts', () => ({
  ConvertLinksInFolderCommandHandler: vi.fn()
}));

vi.mock('./commands/convert-links-in-entire-vault-command-handler.ts', () => ({
  ConvertLinksInEntireVaultCommandHandler: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { RenameDeleteHandlerComponent } from 'obsidian-dev-utils/obsidian/components/rename-delete-handler-component';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

interface PluginInternals {
  onloadImpl(): void;
}

function createPlugin(): Plugin {
  const app = strictProxy<App>({});
  const manifest = strictProxy<PluginManifest>({
    id: 'better-markdown-links',
    name: 'Better Markdown Links'
  });
  return new Plugin(app, manifest);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Plugin', () => {
  it('should expose a map of per-file abort controllers', () => {
    const plugin = createPlugin();

    expect(plugin.processFileAbortControllers).toBeInstanceOf(Map);
  });

  it('should wire up all children on load', () => {
    const plugin = createPlugin();

    castTo<PluginInternals>(plugin).onloadImpl();

    expect(vi.mocked(RenameDeleteHandlerComponent)).toHaveBeenCalledOnce();
    expect(vi.mocked(CommandHandlerComponent)).toHaveBeenCalledOnce();
  });

  it('should register the three conversion command handlers with the plugin name', () => {
    const plugin = createPlugin();

    castTo<PluginInternals>(plugin).onloadImpl();

    const params = vi.mocked(CommandHandlerComponent).mock.calls[0]?.[0];
    expect(params?.commandHandlers.length).toBe(3);
    expect(params?.pluginName).toBe('Better Markdown Links');
  });

  describe('rename/delete settings builder', () => {
    it('should enable rename handling based on the settings', () => {
      const plugin = createPlugin();
      castTo<PluginInternals>(plugin).onloadImpl();

      const builtSettings = vi.mocked(RenameDeleteHandlerComponent).mock.calls[0]?.[0].settingsBuilder();

      expect(builtSettings?.shouldHandleRenames).toBe(true);
      expect(builtSettings?.shouldUpdateFileNameAliases).toBe(true);
    });

    it('should delegate isPathIgnored to the plugin settings', () => {
      const plugin = createPlugin();
      castTo<PluginInternals>(plugin).onloadImpl();

      const builtSettings = vi.mocked(RenameDeleteHandlerComponent).mock.calls[0]?.[0].settingsBuilder();

      expect(builtSettings?.isPathIgnored?.('note.md')).toBe(false);
      expect(builtSettings?.isPathIgnored?.('diagram.excalidraw.md')).toBe(true);
    });
  });
});
