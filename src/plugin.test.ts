import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { Component } from 'obsidian';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';

vi.mock('./plugin-settings-component.ts', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  PluginSettingsComponent: class extends Component {
    public settings = new PluginSettings();
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/rename-delete-handler-component', () => ({
  // eslint-disable-next-line prefer-arrow-callback, func-names -- mock must be constructable with `new` and return a loadable Component.
  RenameDeleteHandlerComponent: vi.fn(function (): Component {
    return new Component();
  })
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/command-handler-component', () => ({
  // eslint-disable-next-line prefer-arrow-callback, func-names -- mock must be constructable with `new` and return a loadable Component.
  CommandHandlerComponent: vi.fn(function (): Component {
    return new Component();
  })
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
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  MenuEventRegistrarComponent: class extends Component {}
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  PluginSettingsTabComponent: class extends Component {}
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

vi.mock('./link-converter.ts', () => ({
  LinkConverter: vi.fn()
}));

vi.mock('./better-markdown-links-component.ts', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  BetterMarkdownLinksComponent: class extends Component {}
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

interface AppGlobal {
  app: AppOriginal;
}

const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

const manifest = strictProxy<PluginManifest>({
  id: 'better-markdown-links',
  name: 'Better Markdown Links'
});

let app: AppOriginal;

async function createLoadedPlugin(): Promise<Plugin> {
  const plugin = new Plugin(app, manifest);
  // PluginBase.onload is async; driving the real async load path directly (as the obsidian-dev-utils reference test does) runs every universal component plus onloadImpl.
  await plugin.onload();
  return plugin;
}

function seedOnRawTarget(strictProxiedObject: object, key: string, value: unknown): void {
  const proxyWithTarget = castTo<Partial<Record<symbol, object>>>(strictProxiedObject);
  const rawTarget = proxyWithTarget[STRICT_PROXY_TARGET_SYMBOL] ?? strictProxiedObject;
  castTo<Record<string, unknown>>(rawTarget)[key] = value;
}

beforeEach(() => {
  vi.clearAllMocks();

  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
    cb();
  });
  app = appMock.asOriginalType__();

  // Seed the obsidianDevUtilsState holder on the raw target behind the strict-proxy App so the real dev-utils universal components can read/write shared state during load.
  seedOnRawTarget(app, 'obsidianDevUtilsState', {});

  // Expose the app as the global instance so dev-utils helpers that resolve shared state without an explicit app argument read/write the same seeded holder.
  castTo<AppGlobal>(window).app = app;
});

describe('Plugin', () => {
  it('should wire up the rename/delete handler once on load', async () => {
    await createLoadedPlugin();

    expect(vi.mocked(RenameDeleteHandlerComponent)).toHaveBeenCalledOnce();
  });

  it('should wire up the command handler once on load', async () => {
    await createLoadedPlugin();

    expect(vi.mocked(CommandHandlerComponent)).toHaveBeenCalledOnce();
  });

  it('should register the three conversion command handlers', async () => {
    await createLoadedPlugin();

    const params = vi.mocked(CommandHandlerComponent).mock.calls[0]?.[0];
    expect(params?.commandHandlers.length).toBe(3);
  });

  it('should register the command handlers with the plugin name', async () => {
    await createLoadedPlugin();

    const params = vi.mocked(CommandHandlerComponent).mock.calls[0]?.[0];
    expect(params?.pluginName).toBe('Better Markdown Links');
  });

  describe('rename/delete settings builder', () => {
    it('should enable rename handling based on the settings', async () => {
      await createLoadedPlugin();

      const builtSettings = vi.mocked(RenameDeleteHandlerComponent).mock.calls[0]?.[0].settingsBuilder();

      expect(builtSettings?.shouldHandleRenames).toBe(true);
    });

    it('should always update file name aliases', async () => {
      await createLoadedPlugin();

      const builtSettings = vi.mocked(RenameDeleteHandlerComponent).mock.calls[0]?.[0].settingsBuilder();

      expect(builtSettings?.shouldUpdateFileNameAliases).toBe(true);
    });

    it('should not ignore a regular markdown path', async () => {
      await createLoadedPlugin();

      const builtSettings = vi.mocked(RenameDeleteHandlerComponent).mock.calls[0]?.[0].settingsBuilder();

      expect(builtSettings?.isPathIgnored?.('note.md')).toBe(false);
    });

    it('should ignore an excalidraw path', async () => {
      await createLoadedPlugin();

      const builtSettings = vi.mocked(RenameDeleteHandlerComponent).mock.calls[0]?.[0].settingsBuilder();

      expect(builtSettings?.isPathIgnored?.('diagram.excalidraw.md')).toBe(true);
    });
  });
});
