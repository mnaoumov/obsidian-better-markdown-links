import type {
  FileManager,
  TFile
} from 'obsidian';

import {
  generateMarkdownLink,
  registerGenerateMarkdownLinkDefaultOptionsFn
} from 'obsidian-dev-utils/obsidian/link';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenerateMarkdownLinkExtendedOptions } from './generate-markdown-link-extended.d.ts';
import type { Plugin } from './plugin.ts';

import { patchGenerateMarkdownLink } from './generate-markdown-link-extended-impl.ts';
import { PluginSettings } from './plugin-settings.ts';

vi.mock('obsidian-dev-utils/obsidian/link', () => ({
  generateMarkdownLink: vi.fn().mockReturnValue('[mock](link.md)'),
  registerGenerateMarkdownLinkDefaultOptionsFn: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/components/monkey-around-component', () => {
  class MonkeyAroundComponent {
    public registerPatch(obj: Record<string, unknown>, factories: Record<string, (next: unknown) => unknown>): void {
      for (const [key, factory] of Object.entries(factories)) {
        obj[key] = factory(obj[key]);
      }
    }
  }
  return { MonkeyAroundComponent };
});

afterEach(() => {
  vi.clearAllMocks();
});

interface MockPluginResult {
  readonly fileManager: Record<string, unknown>;
  readonly plugin: Plugin;
}

function createMockPlugin(): MockPluginResult {
  const settings = new PluginSettings();
  const fileManager: Record<string, unknown> = {};

  // eslint-disable-next-line no-restricted-syntax -- strictProxy would block dynamic property access in MonkeyAroundComponent.registerPatch
  const plugin = {
    addChild: vi.fn().mockImplementation((child: unknown) => child),
    app: {
      fileManager
    },
    pluginSettingsComponent: {
      settings
    }
  } as unknown as Plugin;
  return { fileManager, plugin };
}

describe('patchGenerateMarkdownLink', () => {
  it('should patch generateMarkdownLink on fileManager', () => {
    const { fileManager, plugin } = createMockPlugin();

    function getSettings(): PluginSettings {
      return plugin.pluginSettingsComponent.settings as PluginSettings;
    }

    patchGenerateMarkdownLink(plugin, getSettings);

    expect(fileManager['generateMarkdownLink']).toBeDefined();
  });

  it('should register default options function', () => {
    const { plugin } = createMockPlugin();

    function getSettings(): PluginSettings {
      return plugin.pluginSettingsComponent.settings as PluginSettings;
    }

    patchGenerateMarkdownLink(plugin, getSettings);

    expect(vi.mocked(registerGenerateMarkdownLinkDefaultOptionsFn)).toHaveBeenCalledOnce();
  });

  it('should provide settings-based default options', () => {
    const { plugin } = createMockPlugin();
    const settings = plugin.pluginSettingsComponent.settings as PluginSettings;
    settings.shouldAllowEmptyEmbedAlias = false;
    settings.shouldIncludeAttachmentExtensionToEmbedAlias = true;
    settings.shouldUseAngleBrackets = false;
    settings.shouldUseLeadingDotForRelativePaths = false;
    settings.shouldUseLeadingSlashForAbsolutePaths = false;

    function getSettings(): PluginSettings {
      return settings;
    }

    patchGenerateMarkdownLink(plugin, getSettings);

    const mockedRegister = vi.mocked(registerGenerateMarkdownLinkDefaultOptionsFn);
    const optionsFn = mockedRegister.mock.calls[0]?.[1];
    const options = optionsFn?.();

    expect(options).toEqual({
      isEmptyEmbedAliasAllowed: false,
      shouldIncludeAttachmentExtensionToEmbedAlias: true,
      shouldUseAngleBrackets: false,
      shouldUseLeadingDotForRelativePaths: false,
      shouldUseLeadingSlashForAbsolutePaths: false
    });
  });

  describe('native function', () => {
    it('should call generateMarkdownLink with correct parameters', () => {
      const { fileManager, plugin } = createMockPlugin();

      function getSettings(): PluginSettings {
        return plugin.pluginSettingsComponent.settings as PluginSettings;
      }

      patchGenerateMarkdownLink(plugin, getSettings);

      const nativeFn = fileManager['generateMarkdownLink'] as FileManager['generateMarkdownLink'];
      const file = strictProxy<TFile>({ path: 'target.md' });
      const result = nativeFn(file, 'source.md', '#heading', 'alias');

      expect(result).toBe('[mock](link.md)');
      expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledOnce();
    });

    it('should pass undefined subpath and alias when not provided', () => {
      const { fileManager, plugin } = createMockPlugin();

      function getSettings(): PluginSettings {
        return plugin.pluginSettingsComponent.settings as PluginSettings;
      }

      patchGenerateMarkdownLink(plugin, getSettings);

      const nativeFn = fileManager['generateMarkdownLink'] as FileManager['generateMarkdownLink'];
      const file = strictProxy<TFile>({ path: 'target.md' });
      nativeFn(file, 'source.md');

      expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledOnce();
    });
  });

  describe('extended function', () => {
    it('should call generateMarkdownLink with extended options', () => {
      const { fileManager, plugin } = createMockPlugin();

      function getSettings(): PluginSettings {
        return plugin.pluginSettingsComponent.settings as PluginSettings;
      }

      patchGenerateMarkdownLink(plugin, getSettings);

      interface ExtendedGenerateMarkdownLink {
        extended(options: GenerateMarkdownLinkExtendedOptions): string;
      }

      const extendedFn = (fileManager['generateMarkdownLink'] as ExtendedGenerateMarkdownLink).extended;
      const options: GenerateMarkdownLinkExtendedOptions = {
        sourcePathOrFile: 'source.md',
        targetPathOrFile: 'target.md'
      };

      const result = extendedFn(options);

      expect(result).toBe('[mock](link.md)');
      expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledOnce();
    });
  });
});
