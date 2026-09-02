import type {
  Plugin,
  SettingGroup
} from 'obsidian';
import type { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';
import type { PluginSuggestionComponent } from 'obsidian-dev-utils/obsidian/components/plugin-suggestion-component';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { SuggestedPluginState } from 'obsidian-dev-utils/obsidian/components/plugin-suggestion-component';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { ensureNonNullable } from 'obsidian-dev-utils/type-guards';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { LinkStyleMode } from './link-style-mode.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { PluginSettings } from './plugin-settings.ts';

vi.mock('obsidian-dev-utils/html-element', () => ({
  appendCodeBlock: vi.fn()
}));

interface SearchableDefinition {
  searchable?: boolean;
}

interface VisibleDefinition {
  visible(): boolean;
}

const EXPECTED_BOUND_PROPERTIES = [
  'shouldUseLeadingDotForRelativePaths',
  'shouldUseLeadingSlashForAbsolutePaths',
  'shouldUseAngleBrackets',
  'shouldNormalizeFileLinks',
  'linkConversionMode',
  'shouldAllowEmptyEmbedAlias',
  'shouldIncludeAttachmentExtensionToEmbedAlias',
  'linkStyleMode',
  'shouldAppendFileNameWhenDemotingEmbeds',
  'shouldResolveLinksViaAliases',
  'shouldCreateMissingNotes',
  'includePaths',
  'excludePaths'
];

// The suggestion banner rides along as an extra row that binds nothing.
const EXPECTED_DEFINITION_COUNT = EXPECTED_BOUND_PROPERTIES.length + 1;

let getSuggestedPluginState: ReturnType<typeof vi.fn<() => SuggestedPluginState>>;
let renderBanner: ReturnType<typeof vi.fn<(containerEl: HTMLElement) => void>>;

beforeEach(() => {
  vi.clearAllMocks();
  getSuggestedPluginState = vi.fn<() => SuggestedPluginState>(() => SuggestedPluginState.NotInstalled);
  renderBanner = vi.fn<(containerEl: HTMLElement) => void>();
});

function createTab(): PluginSettingsTab {
  const pluginSettingsComponent = strictProxy<PluginSettingsComponentBase<PluginSettings>>({
    defaultSettings: new PluginSettings(),
    on: vi.fn().mockReturnValue({ id: 'ref' }),
    settings: new PluginSettings(),
    settingsState: {
      effectiveValues: new PluginSettings(),
      inputValues: new PluginSettings(),
      validationMessages: {
        excludePaths: '',
        includePaths: '',
        isAdvancedRenameAndDeleteHandlerSuggestionDeclined: '',
        linkConversionMode: '',
        linkStyleMode: '',
        proposedShouldHandleRenames: '',
        shouldAllowEmptyEmbedAlias: '',
        shouldIncludeAttachmentExtensionToEmbedAlias: '',
        shouldNormalizeFileLinks: '',
        shouldUseAngleBrackets: '',
        shouldUseLeadingDotForRelativePaths: '',
        shouldUseLeadingSlashForAbsolutePaths: ''
      }
    }
  });

  const plugin = strictProxy<Plugin>({
    app: {
      workspace: {
        on: vi.fn().mockReturnValue({ id: 'test' })
      }
    }
  });

  const tab = new PluginSettingsTab({
    plugin,
    pluginSettingsComponent,
    pluginSuggestionComponent: strictProxy<PluginSuggestionComponent>({
      getSuggestedPluginState,
      renderBanner
    })
  });
  tab.containerEl = activeWindow.createDiv();
  return tab;
}

describe('PluginSettingsTab', () => {
  it('should create the tab instance', () => {
    const tab = createTab();

    expect(tab).toBeInstanceOf(PluginSettingsTab);
  });

  it('should declare every setting and bind it to the correct property when rendered', () => {
    const tab = createTab();
    const bindSpy = vi.spyOn(tab, 'bind').mockReturnValue(undefined);

    const definitions = tab.getSettingDefinitions();
    for (const definition of definitions) {
      if ('render' in definition) {
        definition.render(new SettingEx(tab.containerEl), castTo<SettingGroup>(null));
      }
    }

    expect(bindSpy.mock.calls.map((call) => call[0].propertyName)).toEqual(EXPECTED_BOUND_PROPERTIES);
    expect(definitions.length).toBe(EXPECTED_DEFINITION_COUNT);
  });

  it('should declare the suggestion banner as the first row', () => {
    const tab = createTab();

    expect(settingNames(tab)[0]).toBe('');
  });

  it('should keep the banner row out of the settings search', () => {
    const tab = createTab();

    expect(castTo<SearchableDefinition>(ensureNonNullable(tab.getSettingDefinitions()[0])).searchable).toBe(false);
  });

  it('should show the banner row while the suggested plugin is not enabled', () => {
    const tab = createTab();

    expect(isBannerRowVisible(tab)).toBe(true);
  });

  it('should hide the banner row once the suggested plugin is enabled', () => {
    getSuggestedPluginState.mockReturnValue(SuggestedPluginState.Enabled);
    const tab = createTab();

    expect(isBannerRowVisible(tab)).toBe(false);
  });

  // The Markdown option is the whole point of the row: without it the plugin can only ever write whatever
  // Obsidian's own `Use [[Wikilinks]]` setting says.
  it('should offer all three link styles, Markdown last', () => {
    const tab = createTab();
    vi.spyOn(tab, 'bind').mockReturnValue(undefined);
    const setting = new SettingEx(tab.containerEl);

    renderRow(tab, settingNames(tab).indexOf('Link style'), setting);

    const select = ensureNonNullable(setting.controlEl.querySelector('select'));
    expect([...select.options].map((option) => option.value)).toEqual([
      LinkStyleMode.PreserveExisting,
      LinkStyleMode.ObsidianSettingsDefault,
      LinkStyleMode.Markdown
    ]);
  });

  it('should render the banner into an emptied row element', () => {
    const tab = createTab();
    const setting = new SettingEx(tab.containerEl);
    setting.setName('Leftover');

    renderRow(tab, 0, setting);

    expect(renderBanner).toHaveBeenCalledWith(setting.settingEl);
    expect(setting.settingEl.textContent).toBe('');
  });
});

/**
 * Evaluates the banner row's `visible` predicate the way Obsidian does on every render.
 *
 * @param tab - The settings tab.
 * @returns Whether the row would be rendered.
 */
function isBannerRowVisible(tab: PluginSettingsTab): boolean {
  const visible = castTo<VisibleDefinition>(ensureNonNullable(tab.getSettingDefinitions()[0])).visible;
  return visible();
}

/**
 * Invokes one declared row's `render` callback the way Obsidian does when the tab is opened.
 *
 * @param tab - The settings tab.
 * @param index - The index of the row.
 * @param setting - The setting to render into.
 */
function renderRow(tab: PluginSettingsTab, index: number, setting: SettingEx): void {
  const definition = ensureNonNullable(tab.getSettingDefinitions()[index]);
  if (!('render' in definition)) {
    throw new Error(`The setting definition at index ${String(index)} does not render.`);
  }

  definition.render(setting, castTo<SettingGroup>(null));
}

/**
 * Reads the declared rows' names, in order.
 *
 * @param tab - The settings tab.
 * @returns The names.
 */
function settingNames(tab: PluginSettingsTab): (string | undefined)[] {
  return tab.getSettingDefinitions().map((definition) => 'name' in definition ? castTo<string>(definition.name) : undefined);
}
