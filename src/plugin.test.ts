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

import type { MigratableSettings } from './advanced-rename-and-delete-handler.ts';

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

const { settingsMigrationStub } = vi.hoisted(() => ({
  settingsMigrationStub: vi.fn<(params: SettingsMigrationComponentParams) => object>()
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

// The same treatment for the dev-utils settings-migration component. What is this plugin's own is the pair
// Of closures it hands over — which pending values are offered, and how the retirement is persisted — so
// They are captured and invoked directly. The offer-and-retire dance around them belongs to dev-utils and is
// Tested there.
vi.mock('obsidian-dev-utils/obsidian/components/settings-migration-component', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian-dev-utils/obsidian/components/settings-migration-component')>();
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn used with `new` must be a non-arrow function returning a fresh real Component.
  settingsMigrationStub.mockImplementation(function NamedStub(): Component {
    return new Component();
  });
  return {
    ...actual,
    SettingsMigrationComponent: settingsMigrationStub
  };
});

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
import { PluginSettingsComponent } from './plugin-settings-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

interface AppGlobal {
  app: AppOriginal;
}

interface PluginSuggestionComponentParams {
  isSuggestionDeclined(this: void): boolean;
  setSuggestionDeclined(this: void, isDeclined: boolean): Promise<void>;
  readonly suggestedPluginId: string;
}

interface SettingsMigrationComponentParams {
  readonly apiVersionRange: string;
  getProposedSettings(this: void): MigratableSettings | null;
  readonly providerPluginId: string;
  retireProposedSettings(this: void): Promise<void>;
  readonly sourcePluginId: string;
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

// The plugin's settings component is protected on `PluginBase`, so the instance it actually handed to the
// Migration component is taken from the children it added.
async function loadAndTakeSettingsComponent(): Promise<PluginSettingsComponent> {
  const plugin = new Plugin(app, manifest);
  const addChildSpy = vi.spyOn(plugin, 'addChild');

  await plugin.onload();

  const settingsComponent = addChildSpy.mock.calls
    .map((call) => call[0])
    .find((child) => child instanceof PluginSettingsComponent);
  if (!settingsComponent) {
    throw new Error('The plugin did not add a PluginSettingsComponent.');
  }

  return settingsComponent;
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
  // The suggestion component reads the registry to decide whether there is anything to suggest.
  // Obsidian-test-mocks models `getPlugin` and `enabledPlugins`, but leaves `manifests` to throw, so only
  // That one is seeded.
  seedOnRawTarget(app.plugins, 'manifests', {});

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
    await createLoadedPlugin();

    expect(settingsMigrationStub).toHaveBeenCalledOnce();
    expect(migrationParams().providerPluginId).toBe('advanced-rename-and-delete-handler');
    expect(migrationParams().sourcePluginId).toBe(manifest.id);
    expect(migrationParams().apiVersionRange).toBe('^1');
  });

  it('should offer nothing while no legacy value is pending', async () => {
    await createLoadedPlugin();

    expect(migrationParams().getProposedSettings()).toBeNull();
  });

  // The path settings travel with the toggle: they scoped this plugin's own handler, so they are what the
  // Vault-wide handler needs to keep behaving the way this plugin did.
  it('should offer the path settings alongside the toggle', async () => {
    const settingsComponent = await loadAndTakeSettingsComponent();
    await settingsComponent.editAndSave((settings) => {
      settings.excludePaths = ['Excluded'];
      settings.includePaths = ['Included'];
      settings.proposedShouldHandleRenames = true;
    });

    expect(migrationParams().getProposedSettings()).toEqual({
      excludePaths: ['Excluded'],
      includePaths: ['Included'],
      shouldHandleRenames: true
    });
  });

  // They are proposed rather than moved: this plugin keeps its own copies, which still scope link conversion.
  it('should keep its own path settings after the migration is applied', async () => {
    const settingsComponent = await loadAndTakeSettingsComponent();
    await settingsComponent.editAndSave((settings) => {
      settings.excludePaths = ['Excluded'];
      settings.proposedShouldHandleRenames = true;
    });

    await migrationParams().retireProposedSettings();

    expect(settingsComponent.settings.excludePaths).toEqual(['Excluded']);
  });

  // Retiring through `editAndSave` rather than `setProperty` is what makes the retirement outlive a reload;
  // The in-memory-only variant would offer the migration again forever.
  it('should retire the pending value to disk once the migration is applied', async () => {
    const settingsComponent = await loadAndTakeSettingsComponent();
    await settingsComponent.editAndSave((settings) => {
      settings.proposedShouldHandleRenames = true;
    });
    const editAndSaveSpy = vi.spyOn(settingsComponent, 'editAndSave');

    await migrationParams().retireProposedSettings();

    expect(editAndSaveSpy).toHaveBeenCalledOnce();
    expect(migrationParams().getProposedSettings()).toBeNull();
  });

  it('should register the plugin command handlers after the base command handler', async () => {
    const registerCommandHandlersSpy = vi.spyOn(CommandHandlerComponent.prototype, 'registerCommandHandlers');

    await createLoadedPlugin();

    expect(registerCommandHandlersSpy).toHaveBeenCalledTimes(2);
  });

  it('should register the six conversion and three demotion command handlers plus the open demo vault command', async () => {
    const registerCommandHandlersSpy = vi.spyOn(CommandHandlerComponent.prototype, 'registerCommandHandlers');

    await createLoadedPlugin();

    // Since obsidian-dev-utils 89.0.0 the handlers are built lazily by a factory, so build them here.
    const commandHandlerFactory = registerCommandHandlersSpy.mock.calls[1]?.[0];
    expect(commandHandlerFactory?.()).toHaveLength(10);
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

function migrationParams(): SettingsMigrationComponentParams {
  const call = settingsMigrationStub.mock.calls[0];
  if (!call) {
    throw new Error('The plugin did not construct a SettingsMigrationComponent.');
  }

  return call[0];
}

function suggestionParams(): PluginSuggestionComponentParams {
  const call = pluginSuggestionStub.mock.calls[0];
  if (!call) {
    throw new Error('The plugin did not construct a PluginSuggestionComponent.');
  }

  return call[0];
}
