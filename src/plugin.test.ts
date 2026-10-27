import type { PluginApiDeclaration } from '@mnaoumov/obsidian-lib/plugin/plugin-api';
import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { CommandHandlerComponent } from '@mnaoumov/obsidian-lib/command-handlers/command-handler-component';
import { ObsidianLibrary } from '@mnaoumov/obsidian-lib/library';
import { Library } from '@mnaoumov/typescript-lib/library';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { Component } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { MigratableSettings } from './rename-delete-handover/advanced-rename-and-delete-handler.ts';

import { ADVANCED_RENAME_AND_DELETE_HANDLER_API_CONTRACT } from './rename-delete-handover/advanced-rename-and-delete-handler-api/api-contract.ts';
import { PluginSettings } from './settings/plugin-settings.ts';

vi.mock('./settings/plugin-settings-component.ts', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  PluginSettingsComponent: class extends Component {
    public settings = new PluginSettings();

    public editAndSave(settingsEditor: (settings: PluginSettings) => void): Promise<void> {
      settingsEditor(this.settings);
      // eslint-disable-next-line typescript-dev-toolkit/prefer-noop-async -- a vi.mock factory cannot reach a top-level import.
      return Promise.resolve();
    }
  }
}));

const { settingsMigrationStub } = vi.hoisted(() => ({
  settingsMigrationStub: vi.fn<(params: SettingsMigrationComponentParams) => object>()
}));

// Capture the `PluginSuggestionComponent` constructor argument so the closures the plugin hands it — the
// declined-flag getter and setter — can be invoked directly. The stub returns a fresh real `Component` so
// the real `PluginBase` lifecycle can load it as a child without reaching the community-plugin registry.
const { pluginSuggestionStub } = vi.hoisted(() => ({
  pluginSuggestionStub: vi.fn<(params: PluginSuggestionComponentParams) => object>()
}));

vi.mock('@mnaoumov/obsidian-lib/components/plugin-suggestion-component', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mnaoumov/obsidian-lib/components/plugin-suggestion-component')>();
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn used with `new` must be a non-arrow function returning a fresh real Component.
  pluginSuggestionStub.mockImplementation(function NamedStub(): Component {
    return new Component();
  });
  return {
    ...actual,
    PluginSuggestionComponent: pluginSuggestionStub
  };
});

// The same treatment for the obsidian-lib settings-migration component. What is this plugin's own is the pair
// of closures it hands over — which pending values are offered, and how the retirement is persisted — so
// they are captured and invoked directly. The offer-and-retire dance around them belongs to obsidian-lib and is
// tested there.
vi.mock('@mnaoumov/obsidian-lib/components/settings-migration-component', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mnaoumov/obsidian-lib/components/settings-migration-component')>();
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn used with `new` must be a non-arrow function returning a fresh real Component.
  settingsMigrationStub.mockImplementation(function NamedStub(): Component {
    return new Component();
  });
  return {
    ...actual,
    SettingsMigrationComponent: settingsMigrationStub
  };
});

// `PluginDataHandler` and `PluginEventSourceImpl` are NOT stubbed: the base
// builds its own settings component out of them during `onload`, and that component really calls
// `pluginEventSource.on`, so a bare `vi.fn()` double makes the base throw before `onloadImpl` runs.
vi.mock('@mnaoumov/obsidian-lib/components/plugin-settings-tab-component', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  PluginSettingsTabComponent: class extends Component {}
}));

vi.mock('./settings/plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

vi.mock('./conversion/link-converter.ts', () => ({
  LinkConverter: vi.fn()
}));

vi.mock('./automatic-conversion/better-markdown-links-component.ts', () => ({
  // Extends the real obsidian-test-mocks Component so the real addChild lifecycle can load it.
  BetterMarkdownLinksComponent: class extends Component {}
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginApiImpl } from './link-generation/plugin-api-impl.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  PLUGIN_API_CONTRACT,
  PLUGIN_API_VERSION
} from './link-generation/plugin-api.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsComponent } from './settings/plugin-settings-component.ts';

interface AppGlobal {
  app: AppOriginal;
}

interface PluginApisReader {
  getPluginApis: () => PluginApiDeclaration[];
}

interface PluginSuggestionComponentParams {
  readonly isSuggestionDeclined: (this: void) => boolean;
  readonly reason: DocumentFragment | string;
  readonly setSuggestionDeclined: (this: void, isDeclined: boolean) => Promise<void>;
  readonly suggestedPluginId: string;
}

interface SettingsMigrationComponentParams {
  readonly apiVersionRange: string;
  readonly contract: Readonly<Record<string, unknown>>;
  readonly getProposedSettings: (this: void) => MigratableSettings | null;
  readonly providerPluginId: string;
  readonly retireProposedSettings: (this: void) => Promise<void>;
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
  // PluginBase.onload is async; driving the real async load path directly (as the `@mnaoumov/obsidian-lib` reference test does) runs every universal component plus onloadImpl.
  await plugin.onload();
  return plugin;
}

// The plugin's settings component is protected on `PluginBase`, so the instance it actually handed to the
// migration component is taken from the children it added.
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
  // Each test loads a fresh plugin and never unloads it, and the library's contexts initialize only once
  // per load, so they are reset here the way the plugin context's own unload would reset them.
  Library.resetToDefault();
  ObsidianLibrary.resetToDefault();

  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((callback: () => void) => {
    callback();
  });
  app = appMock.asOriginalType__();

  // The suggestion component reads the registry to decide whether there is anything to suggest.
  // Obsidian-test-mocks models `getPlugin` and `enabledPlugins`, but leaves `manifests` to throw, so only
  // that one is seeded.
  seedOnRawTarget(app.plugins, 'manifests', {});

  // Expose the app as the global instance so obsidian-lib helpers that resolve shared state without an explicit app argument read/write the same seeded holder.
  castTo<AppGlobal>(window).app = app;
});

describe('Plugin', () => {
  // `Advanced Rename and Delete Handler` owns rename/delete handling since 5.0.0. Two handlers acting on one
  // rename corrupts links, so this plugin must register none — the inverse of what it used to assert.
  it('should not construct a rename/delete handler of its own', async () => {
    const renameDeleteHandlerModule = await import('@mnaoumov/obsidian-lib/components/rename-delete-handler-component');
    const renameDeleteHandlerSpy = vi.spyOn(renameDeleteHandlerModule, 'RenameDeleteHandlerComponent');

    await createLoadedPlugin();

    expect(renameDeleteHandlerSpy).not.toHaveBeenCalled();
  });

  it('should suggest Advanced Rename and Delete Handler instead', async () => {
    await createLoadedPlugin();

    expect(pluginSuggestionStub).toHaveBeenCalledOnce();
    expect(suggestionParams().suggestedPluginId).toBe('advanced-rename-and-delete-handler');
  });

  it('should name both plugins in the suggestion reason as code', async () => {
    await createLoadedPlugin();

    const { reason } = suggestionParams();
    if (!(reason instanceof DocumentFragment)) {
      throw new TypeError('The suggestion reason is not a fragment.');
    }

    expect(Array.from(reason.querySelectorAll('code'), (code) => code.textContent)).toEqual([
      'Better Markdown Links',
      'Advanced Rename and Delete Handler'
    ]);
    expect(reason.textContent).toBe(
      'Better Markdown Links no longer handles renames itself. Without Advanced Rename and Delete Handler,'
        + ' Obsidian\'s own link update runs instead, and it does not write the readable link format this plugin generates.'
    );
  });

  it('should report the suggestion as not declined until the user says otherwise', async () => {
    await createLoadedPlugin();

    expect(suggestionParams().isSuggestionDeclined()).toBe(false);
  });

  // Through `editAndSave`, not `setProperty`: a decline has to outlive a reload, and `setProperty` only
  // edits the in-memory state.
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
    // Narrow, and the provider's own entry: both schemas, no `{}` restatement.
    expect(migrationParams().contract).toEqual({
      migrateSettings: ADVANCED_RENAME_AND_DELETE_HANDLER_API_CONTRACT.migrateSettings
    });
  });

  it('should offer nothing while no legacy value is pending', async () => {
    await createLoadedPlugin();

    expect(migrationParams().getProposedSettings()).toBeNull();
  });

  // The path settings travel with the toggle: they scoped this plugin's own handler, so they are what the
  // vault-wide handler needs to keep behaving the way this plugin did.
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

  it('should register the twelve conversion and four demotion command handlers plus the open demo vault command', async () => {
    const registerCommandHandlersSpy = vi.spyOn(CommandHandlerComponent.prototype, 'registerCommandHandlers');

    await createLoadedPlugin();

    // The handlers are built lazily by a factory, so build them here.
    const commandHandlerFactory = registerCommandHandlersSpy.mock.calls[1]?.[0];
    expect(commandHandlerFactory?.()).toHaveLength(17);
  });

  it('should declare no api before it has loaded', () => {
    const plugin = new Plugin(app, manifest);

    expect(castTo<PluginApisReader>(plugin).getPluginApis()).toEqual([]);
  });

  it('should declare the api for the base to publish once it has loaded', async () => {
    const plugin = await createLoadedPlugin();

    const declarations = castTo<PluginApisReader>(plugin).getPluginApis();
    expect(declarations).toHaveLength(1);
    expect(declarations[0]?.api).toBeInstanceOf(PluginApiImpl);
    expect(declarations[0]?.apiVersion).toBe(PLUGIN_API_VERSION);
    expect(declarations[0]?.contract).toBe(PLUGIN_API_CONTRACT);
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
