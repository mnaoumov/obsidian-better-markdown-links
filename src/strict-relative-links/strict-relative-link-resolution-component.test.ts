import type {
  App,
  TFile as TFileOriginal
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { TFile } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { PluginSettings } from '../settings/plugin-settings.ts';
import { StrictRelativeLinkResolutionComponent } from './strict-relative-link-resolution-component.ts';

interface CreateComponentResult {
  readonly component: StrictRelativeLinkResolutionComponent;
  readonly originalResolve: ReturnType<typeof vi.fn<ResolveLinkPath>>;
  readonly queueFileForLinkResolution: ReturnType<typeof vi.fn<(file: null | TFileOriginal) => void>>;
  readonly resolve: ResolveLinkPath;
  readonly saveSettings: (oldSettings: PluginSettings) => void;
  readonly settings: PluginSettings;
}

type ResolveLinkPath = (linkPath: string, sourcePath: string) => TFileOriginal[];

interface SettingsState {
  readonly effectiveValues: PluginSettings;
}

const loadedComponents: StrictRelativeLinkResolutionComponent[] = [];

function createComponent(settings = new PluginSettings()): CreateComponentResult {
  type SaveSettingsCallback = (newState: SettingsState, oldState: SettingsState) => void;
  const files = new Map<string, TFileOriginal>();
  const vault = strictProxy<App['vault']>({
    getAbstractFileByPathInsensitive: (): null => null,
    getFileByPath: (path: string): null | TFileOriginal => files.get(path) ?? null
  });
  for (const path of ['a/issues.md', 'b/issues.md']) {
    files.set(path, TFile.create__(castTo(vault), path).asOriginalType2__());
  }

  const originalResolve = vi.fn<ResolveLinkPath>().mockReturnValue([ensureNonNullable(files.get('b/issues.md'))]);
  const queueFileForLinkResolution = vi.fn<(file: null | TFileOriginal) => void>();
  const metadataCache: Record<string, unknown> = {
    getCachedFiles: (): string[] => ['a/issues.md', 'b/issues.md', 'gone.md'],
    // eslint-disable-next-line unicorn/name-replacements -- `getLinkpathDest` is Obsidian's own API name; the mock must match it.
    getLinkpathDest: originalResolve,
    queueFileForLinkResolution
  };

  let saveSettingsCallback: null | SaveSettingsCallback = null;
  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({
    on: castTo<PluginSettingsComponent['on']>((_name: string, callback: SaveSettingsCallback) => {
      saveSettingsCallback = callback;
      return { asyncEventSource: { offref: vi.fn() } };
    }),
    settings
  });

  const component = new StrictRelativeLinkResolutionComponent({
    app: strictProxy<App>({ metadataCache: castTo(metadataCache), vault }),
    pluginSettingsComponent
  });
  loadedComponents.push(component);
  component.load();

  return {
    component,
    originalResolve,
    queueFileForLinkResolution,
    resolve: (linkPath, sourcePath) => castTo<ResolveLinkPath>(metadataCache['getLinkpathDest'])(linkPath, sourcePath),
    saveSettings: (oldSettings): void => {
      saveSettingsCallback?.({ effectiveValues: settings }, { effectiveValues: oldSettings });
    },
    settings
  };
}

function strictSettings(): PluginSettings {
  const settings = new PluginSettings();
  settings.shouldResolveLinksStrictly = true;
  return settings;
}

afterEach(() => {
  while (loadedComponents.length > 0) {
    loadedComponents.pop()?.unload();
  }
});

describe('StrictRelativeLinkResolutionComponent', () => {
  it('should leave resolution to core while the setting is off', () => {
    const { originalResolve, resolve } = createComponent();

    expect(resolve('issues', 'a/note.md').map((file) => file.path)).toEqual(['b/issues.md']);
    expect(originalResolve).toHaveBeenCalledOnce();
  });

  it('should resolve strictly while the setting is on', () => {
    const { originalResolve, resolve } = createComponent(strictSettings());

    expect(resolve('issues', 'a/note.md').map((file) => file.path)).toEqual(['a/issues.md']);
    expect(resolve('issues', 'c/note.md')).toEqual([]);
    expect(originalResolve).not.toHaveBeenCalled();
  });

  it('should leave a name lookup with no source note to core', () => {
    const { originalResolve, resolve } = createComponent(strictSettings());

    expect(resolve('issues', '').map((file) => file.path)).toEqual(['b/issues.md']);
    expect(originalResolve).toHaveBeenCalledOnce();
  });

  it('should resolve every note again on load when the setting is on', () => {
    const { queueFileForLinkResolution } = createComponent(strictSettings());

    expect(queueFileForLinkResolution.mock.calls.map(([file]) => file?.path)).toEqual(['a/issues.md', 'b/issues.md']);
  });

  it('should not resolve anything again on load when the setting is off', () => {
    const { queueFileForLinkResolution } = createComponent();

    expect(queueFileForLinkResolution).not.toHaveBeenCalled();
  });

  it('should resolve every note again when the setting changes, and only then', () => {
    const { queueFileForLinkResolution, saveSettings, settings } = createComponent();

    saveSettings(new PluginSettings());
    expect(queueFileForLinkResolution).not.toHaveBeenCalled();

    settings.shouldResolveLinksStrictly = true;
    saveSettings(new PluginSettings());
    expect(queueFileForLinkResolution).toHaveBeenCalledTimes(2);
  });

  it('should resolve every note again on unload when the setting is on', () => {
    const { component, queueFileForLinkResolution } = createComponent(strictSettings());
    queueFileForLinkResolution.mockClear();

    component.unload();

    expect(queueFileForLinkResolution).toHaveBeenCalledTimes(2);
  });
});
