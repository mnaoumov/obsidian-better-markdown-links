import type { Plugin } from 'obsidian';
import type { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { PluginSettings } from './plugin-settings.ts';

vi.mock('obsidian-dev-utils/html-element', () => ({
  appendCodeBlock: vi.fn()
}));

type CallbackFn = (...args: unknown[]) => unknown;

vi.mock('obsidian-dev-utils/obsidian/setting-ex', () => {
  function createMockValueComponent(): Record<string, CallbackFn> {
    const component: Record<string, CallbackFn> = {
      getValue: vi.fn().mockReturnValue(false),
      onChange: vi.fn().mockReturnThis(),
      setPlaceholder: vi.fn().mockReturnThis(),
      setTooltip: vi.fn().mockReturnThis(),
      setValue: vi.fn().mockReturnThis()
    };
    return component;
  }
  class SettingEx {
    public addMultipleText(cb: CallbackFn): this {
      cb(createMockValueComponent());
      return this;
    }

    public addToggle(cb: CallbackFn): this {
      cb(createMockValueComponent());
      return this;
    }

    public setDesc(_desc: unknown): this {
      return this;
    }

    public setName(_name: string): this {
      return this;
    }
  }
  return { SettingEx };
});

function createMockSettingsComponent(): PluginSettingsComponentBase<PluginSettings> {
  // eslint-disable-next-line no-restricted-syntax -- strictProxy blocks dynamic property access needed by PluginSettingsTabBase.bind()
  return {
    defaultSettings: new PluginSettings(),
    on: vi.fn().mockReturnValue({ id: 0 }),
    settings: new PluginSettings(),
    settingsState: {
      effectiveValues: new PluginSettings(),
      inputValues: new PluginSettings(),
      validationMessages: {} as Record<string, string>
    }
  } as unknown as PluginSettingsComponentBase<PluginSettings>;
}

describe('PluginSettingsTab', () => {
  it('should create tab and display settings', () => {
    const plugin = strictProxy<Plugin>({
      app: {
        workspace: {
          on: vi.fn().mockReturnValue({})
        }
      }
    });
    const pluginSettingsComponent = createMockSettingsComponent();

    const tab = new PluginSettingsTab({ plugin, pluginSettingsComponent });

    expect(tab).toBeDefined();
  });

  it('should render all settings in display()', () => {
    const plugin = strictProxy<Plugin>({
      app: {
        workspace: {
          on: vi.fn().mockReturnValue({})
        }
      }
    });
    const pluginSettingsComponent = createMockSettingsComponent();
    const tab = new PluginSettingsTab({ plugin, pluginSettingsComponent });

    tab.display();

    expect(tab.containerEl).toBeDefined();
  });
});
