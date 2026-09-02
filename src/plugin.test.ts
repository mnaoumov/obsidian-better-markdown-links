import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { Component } from 'obsidian';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
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

    public editAndSave(settingsEditor: (settings: PluginSettings) => void): Promise<void> {
      settingsEditor(this.settings);
      // eslint-disable-next-line obsidian-dev-utils/prefer-noop-async -- a vi.mock factory cannot reach a top-level import.
      return Promise.resolve();
    }
  }
}));

// Capture the `PluginSuggestionComponent` constructor argument so the closures the plugin hands it — the
// Declined-flag getter and setter — can be invoked directly. The stub returns a fresh real `Component` so
// The real `PluginBase` lifecycle can load it as a child without reaching the community-plugin registry.
const { pluginSuggestionStub } = vi.hoisted(() => ({
  pluginSuggestionStub: vi.fn<(params: PluginSuggestionComponentParams) => object>()
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-suggestion-component', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian-dev-utils/obsidian/components/plugin-suggestion-component')>();
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn used with `new` must be a non-arrow function returning a fresh real Component.
  pluginSuggestionStub.mockImplementation(function NamedStub(): Component {
    return new Component();
  });
  return {
    ...actual,
    PluginSuggestionComponent: pluginSuggestionStub
  };
});

vi.mock('./rename-delete-handler-migration-component.ts', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  RenameDeleteHandlerMigrationComponent: class extends Component {}
}));

// `PluginDataHandler` and `PluginEventSourceImpl` are NOT stubbed: since obsidian-dev-utils 93.2 the base
// Builds its own settings component out of them during `onload`, and that component really calls
// `pluginEventSource.on`, so a bare `vi.fn()` double makes the base throw before `onloadImpl` runs (G49).
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

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { RenameDeleteHandlerMigrationComponent } from './rename-delete-handler-migration-component.ts';

interface AppGlobal {
  app: AppOriginal;
}

interface PluginSuggestionComponentParams {
  isSuggestionDeclined(this: void): boolean;
  setSuggestionDeclined(this: void, isDeclined: boolean): Promise<void>;
  readonly suggestedPluginId: string;
}

const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

const manifest = strictProxy<PluginManifest>({
  id: 'better-markdown-links',
  name: 'Better Markdown Links',
  version: '1.0.0'
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
  appMock.workspace.onLayoutReady = vi.fn((callback: () => void) => {
    callback();
  });
  app = appMock.asOriginalType__();

  // Seed the obsidianDevUtilsState holder on the raw target behind the strict-proxy App so the real dev-utils universal components can read/write shared state during load.
  seedOnRawTarget(app, 'obsidianDevUtilsState', {});
  // Since obsidian-dev-utils 89.0.0 the base bridges its command handlers into Notebook Navigator's
  // Menus, which looks the plugin up on layout-ready -- so `plugins` has to answer on the strict mock.
  // The suggestion component reads the registry too, to decide whether there is anything to suggest.
  seedOnRawTarget(app, 'plugins', {
    enabledPlugins: new Set<string>(),
    getPlugin: vi.fn().mockReturnValue(null),
    manifests: {}
  });

  // Expose the app as the global instance so dev-utils helpers that resolve shared state without an explicit app argument read/write the same seeded holder.
  castTo<AppGlobal>(window).app = app;
});

describe('Plugin', () => {
  // Advanced Rename and Delete Handler owns rename/delete handling since 5.0.0. Two handlers acting on one
  // Rename corrupts links, so this plugin must register none — the inverse of what it used to assert.
  it('should not construct a rename/delete handler of its own', async () => {
    const renameDeleteHandlerModule = await import('obsidian-dev-utils/obsidian/components/rename-delete-handler-component');
    const renameDeleteHandlerSpy = vi.spyOn(renameDeleteHandlerModule, 'RenameDeleteHandlerComponent');

    await createLoadedPlugin();

    expect(renameDeleteHandlerSpy).not.toHaveBeenCalled();
  });

  it('should suggest Advanced Rename and Delete Handler instead', async () => {
    await createLoadedPlugin();

    expect(pluginSuggestionStub).toHaveBeenCalledOnce();
    expect(suggestionParams().suggestedPluginId).toBe('advanced-rename-and-delete-handler');
  });

  it('should report the suggestion as not declined until the user says otherwise', async () => {
    await createLoadedPlugin();

    expect(suggestionParams().isSuggestionDeclined()).toBe(false);
  });

  // Through `editAndSave`, not `setProperty`: a decline has to outlive a reload, and `setProperty` only
  // Edits the in-memory state.
  it('should remember a declined suggestion in its own settings', async () => {
    await createLoadedPlugin();
    const params = suggestionParams();

    await params.setSuggestionDeclined(true);

    expect(params.isSuggestionDeclined()).toBe(true);
  });

  it('should wire up the settings migration once on load', async () => {
    const plugin = new Plugin(app, manifest);
    const addChildSpy = vi.spyOn(plugin, 'addChild');

    await plugin.onload();

    const migrationComponents = addChildSpy.mock.calls.filter((call) => call[0] instanceof RenameDeleteHandlerMigrationComponent);
    expect(migrationComponents).toHaveLength(1);
  });

  it('should register the plugin command handlers after the base command handler', async () => {
    const registerCommandHandlersSpy = vi.spyOn(CommandHandlerComponent.prototype, 'registerCommandHandlers');

    await createLoadedPlugin();

    expect(registerCommandHandlersSpy).toHaveBeenCalledTimes(2);
  });

  it('should register the three conversion command handlers plus the open demo vault command', async () => {
    const registerCommandHandlersSpy = vi.spyOn(CommandHandlerComponent.prototype, 'registerCommandHandlers');

    await createLoadedPlugin();

    // Since obsidian-dev-utils 89.0.0 the handlers are built lazily by a factory, so build them here.
    const commandHandlerFactory = registerCommandHandlersSpy.mock.calls[1]?.[0];
    expect(commandHandlerFactory?.()).toHaveLength(4);
  });

  it('should register the open demo vault command via its command handler', async () => {
    const plugin = new Plugin(app, manifest);
    const addCommandSpy = vi.spyOn(plugin, 'addCommand');

    await plugin.onload();

    expect(addCommandSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'open-demo-vault' })
    );
  });
});

function suggestionParams(): PluginSuggestionComponentParams {
  const call = pluginSuggestionStub.mock.calls[0];
  if (!call) {
    throw new Error('The plugin did not construct a PluginSuggestionComponent.');
  }

  return call[0];
}
