import type { AsyncEventRef } from 'obsidian-dev-utils/async-events';
import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettings } from './plugin-settings.ts';

interface CreateComponentOptions {
  readonly loadDataReturnValue?: null | Record<string, unknown>;
}

function createComponent(options?: CreateComponentOptions): PluginSettingsComponent {
  const dataHandler = strictProxy<DataHandler>({
    loadData: vi.fn<() => Promise<null | Record<string, unknown>>>().mockResolvedValue(options?.loadDataReturnValue ?? null),
    saveData: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined)
  });
  const pluginEventSource = strictProxy<PluginEventSource>({
    off: vi.fn(),
    offref: vi.fn(),
    on() {
      return castTo<AsyncEventRef>({ id: 0 });
    },
    once() {
      return castTo<AsyncEventRef>({ id: 0 });
    }
  });
  return new PluginSettingsComponent({ dataHandler, pluginEventSource });
}

describe('PluginSettingsComponent', () => {
  describe('constructor', () => {
    it('should create component with default settings', () => {
      const component = createComponent();

      expect(component.settings).toBeDefined();
      expect(component.defaultSettings).toBeInstanceOf(PluginSettings);
    });
  });

  describe('validators', () => {
    it('should accept valid string paths', async () => {
      const component = createComponent();
      const settings = new PluginSettings();
      settings.includePaths = ['some/path'];

      const result = await component.validate(settings);

      expect(result.includePaths).toBeUndefined();
    });

    it('should accept valid regex paths', async () => {
      const component = createComponent();
      const settings = new PluginSettings();
      settings.includePaths = ['/.+\\.md$/'];

      const result = await component.validate(settings);

      expect(result.includePaths).toBeUndefined();
    });

    it('should reject invalid regex paths in includePaths', async () => {
      const component = createComponent();
      const settings = new PluginSettings();
      Object.defineProperty(settings, 'includePaths', { get: () => ['/[invalid/'] });

      const result = await component.validate(settings);

      expect(result.includePaths).toBe('Invalid regular expression /[invalid/');
    });

    it('should reject invalid regex paths in excludePaths', async () => {
      const component = createComponent();
      const settings = new PluginSettings();
      Object.defineProperty(settings, 'excludePaths', { get: () => ['/[invalid/'] });

      const result = await component.validate(settings);

      expect(result.excludePaths).toBe('Invalid regular expression /[invalid/');
    });

    it('should not treat paths without leading and trailing slashes as regex', async () => {
      const component = createComponent();
      const settings = new PluginSettings();
      settings.includePaths = ['[not-a-regex'];

      const result = await component.validate(settings);

      expect(result.includePaths).toBeUndefined();
    });

    it('should accept empty paths array', async () => {
      const component = createComponent();
      const settings = new PluginSettings();
      settings.includePaths = [];

      const result = await component.validate(settings);

      expect(result.includePaths).toBeUndefined();
    });
  });

  describe('legacy settings converters', () => {
    it('should convert allowEmptyEmbedAlias to shouldAllowEmptyEmbedAlias', async () => {
      const component = createComponent({
        loadDataReturnValue: { allowEmptyEmbedAlias: false }
      });
      await component.loadWithPromises();

      expect(component.settings.shouldAllowEmptyEmbedAlias).toBe(false);
    });

    it('should convert automaticallyConvertNewLinks to the OnExplicitCommand link conversion mode when false', async () => {
      const component = createComponent({
        loadDataReturnValue: { automaticallyConvertNewLinks: false }
      });
      await component.loadWithPromises();

      expect(component.settings.linkConversionMode).toBe(LinkConversionMode.OnExplicitCommand);
    });

    it('should convert automaticallyConvertNewLinks to the OnEveryModification link conversion mode when true', async () => {
      const component = createComponent({
        loadDataReturnValue: { automaticallyConvertNewLinks: true }
      });
      await component.loadWithPromises();

      expect(component.settings.linkConversionMode).toBe(LinkConversionMode.OnEveryModification);
    });

    it('should convert shouldAutomaticallyConvertNewLinks to the OnExplicitCommand link conversion mode when false', async () => {
      const component = createComponent({
        loadDataReturnValue: { shouldAutomaticallyConvertNewLinks: false }
      });
      await component.loadWithPromises();

      expect(component.settings.linkConversionMode).toBe(LinkConversionMode.OnExplicitCommand);
    });

    it('should convert shouldAutomaticallyConvertNewLinks to the OnEveryModification link conversion mode when true', async () => {
      const component = createComponent({
        loadDataReturnValue: { shouldAutomaticallyConvertNewLinks: true }
      });
      await component.loadWithPromises();

      expect(component.settings.linkConversionMode).toBe(LinkConversionMode.OnEveryModification);
    });

    it('should convert automaticallyUpdateLinksOnRenameOrMove to shouldAutomaticallyUpdateLinksOnRenameOrMove', async () => {
      const component = createComponent({
        loadDataReturnValue: { automaticallyUpdateLinksOnRenameOrMove: false }
      });
      await component.loadWithPromises();

      expect(component.settings.shouldAutomaticallyUpdateLinksOnRenameOrMove).toBe(false);
    });

    it('should convert includeAttachmentExtensionToEmbedAlias to shouldIncludeAttachmentExtensionToEmbedAlias', async () => {
      const component = createComponent({
        loadDataReturnValue: { includeAttachmentExtensionToEmbedAlias: true }
      });
      await component.loadWithPromises();

      expect(component.settings.shouldIncludeAttachmentExtensionToEmbedAlias).toBe(true);
    });

    it('should convert useAngleBrackets to shouldUseAngleBrackets', async () => {
      const component = createComponent({
        loadDataReturnValue: { useAngleBrackets: false }
      });
      await component.loadWithPromises();

      expect(component.settings.shouldUseAngleBrackets).toBe(false);
    });

    it('should convert useLeadingDot to shouldUseLeadingDotForRelativePaths', async () => {
      const component = createComponent({
        loadDataReturnValue: { useLeadingDot: false }
      });
      await component.loadWithPromises();

      expect(component.settings.shouldUseLeadingDotForRelativePaths).toBe(false);
    });

    it('should convert shouldUseLeadingDot to shouldUseLeadingDotForRelativePaths', async () => {
      const component = createComponent({
        loadDataReturnValue: { shouldUseLeadingDot: false }
      });
      await component.loadWithPromises();

      expect(component.settings.shouldUseLeadingDotForRelativePaths).toBe(false);
    });

    it('should not overwrite settings when legacy fields are undefined', async () => {
      const component = createComponent({
        loadDataReturnValue: {}
      });
      await component.loadWithPromises();

      const defaults = new PluginSettings();
      expect(component.settings.shouldAllowEmptyEmbedAlias).toBe(defaults.shouldAllowEmptyEmbedAlias);
      expect(component.settings.linkConversionMode).toBe(defaults.linkConversionMode);
    });
  });
});
