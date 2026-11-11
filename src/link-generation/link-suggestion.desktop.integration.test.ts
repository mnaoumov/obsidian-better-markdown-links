/**
 * @file
 *
 * Integration suite for issue #46: a link inserted by the `[[` autocomplete is written in the configured style.
 *
 * Obsidian's link suggester builds the inserted link itself and never calls `fileManager.generateMarkdownLink`, so
 * before the fix it inserted `[target with space](target%20with%20space.md)` whatever this plugin's settings said. Each
 * scenario types into a real editor with trusted keystrokes, waits for the real suggester to open, accepts its first
 * suggestion with a trusted `Enter`, then types one more character to prove where the cursor was left.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import type { SettingTab } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from '../settings/plugin-settings.ts';

import { LinkStyleMode } from '../settings/link-style-mode.ts';

/**
 * Parameters for {@link runAutocompleteScenario}.
 */
interface RunAutocompleteScenarioParams {
  /**
   * The plugin's link style mode.
   */
  readonly linkStyleMode: LinkStyleMode;

  /**
   * The text typed after `[[`, before `Enter` accepts the first suggestion.
   */
  readonly query: string;

  /**
   * The note to type into; created empty.
   */
  readonly sourcePath: string;

  /**
   * Obsidian's own `Use [[Wikilinks]]` setting, inverted.
   */
  readonly useMarkdownLinks: boolean;
}

/**
 * The (otherwise protected) settings component exposed for the test, letting it change settings the
 * same way the plugin's own settings UI does.
 */
interface TestableSettingsComponent {
  readonly editAndSave: (settingsEditor: (settings: PluginSettings) => Promise<void> | void) => Promise<void>;
}

/**
 * The plugin's settings tab, exposing its settings component.
 */
interface TestableSettingsTab extends SettingTab {
  readonly pluginSettingsComponent: TestableSettingsComponent;
}

const PLUGIN_ID = 'better-markdown-links';
const TARGET_PATH = 'autocomplete/target with space.md';
const TARGET_CONTENT = '# Section one\n\ntext\n';
const CURSOR_MARKER = 'X';

describe('[[ autocomplete link style (Desktop)', () => {
  beforeAll(async () => {
    await evalInObsidian({
      async callback({ app, targetContent, targetPath }) {
        app.vault.setConfig('newLinkFormat', 'relative');

        const existing = app.vault.getAbstractFileByPath(targetPath);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }

        const folderPath = targetPath.split('/').slice(0, -1).join('/');
        if (!app.vault.getAbstractFileByPath(folderPath)) {
          await app.vault.createFolder(folderPath);
        }

        await app.vault.create(targetPath, targetContent);
      },
      input: { targetContent: TARGET_CONTENT, targetPath: TARGET_PATH },
      vaultPath: getTemporaryVault().path
    });
  });

  it('should insert a note link with angle brackets and a leading dot, with the cursor after it', async () => {
    const content = await runAutocompleteScenario({
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      query: 'target with',
      sourcePath: 'autocomplete/note.md',
      useMarkdownLinks: true
    });

    expect(content).toBe(`[target with space](<./target with space.md>)${CURSOR_MARKER}`);
  });

  it('should insert a heading link with angle brackets and no percent-encoding', async () => {
    const content = await runAutocompleteScenario({
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      query: 'target with space#Section',
      sourcePath: 'autocomplete/heading.md',
      useMarkdownLinks: true
    });

    expect(content).toBe(`[Section one](<./target with space.md#Section one>)${CURSOR_MARKER}`);
  });

  it('should insert a markdown link when the plugin forces markdown links over Obsidian wikilinks', async () => {
    const content = await runAutocompleteScenario({
      linkStyleMode: LinkStyleMode.Markdown,
      query: 'target with',
      sourcePath: 'autocomplete/forced.md',
      useMarkdownLinks: false
    });

    expect(content).toBe(`[target with space](<./target with space.md>)${CURSOR_MARKER}`);
  });
});

/**
 * Applies the settings, types `[[` and the query into a fresh note, accepts the first suggestion with `Enter`, types
 * {@link CURSOR_MARKER}, and returns the editor's content.
 *
 * @param params - See {@link RunAutocompleteScenarioParams}.
 * @returns The editor's content.
 */
async function runAutocompleteScenario(params: RunAutocompleteScenarioParams): Promise<string> {
  return evalInObsidian({
    async callback({
      app,
      cursorMarker,
      lib: {
        pressKey,
        typeIntoEditor,
        waitUntil
      },
      linkStyleMode,
      obsidianModule,
      pluginId,
      query,
      sourcePath,
      useMarkdownLinks
    }): Promise<string> {
      app.vault.setConfig('useMarkdownLinks', useMarkdownLinks);

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkStyleMode = linkStyleMode;
        settings.shouldUseAngleBrackets = true;
        settings.shouldUseLeadingDotForRelativePaths = true;
      });

      const existing = app.vault.getAbstractFileByPath(sourcePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }

      const sourceFile = await app.vault.create(sourcePath, '');
      await app.workspace.getLeaf(false).openFile(sourceFile);

      await waitUntil({
        message: 'the markdown editor to open',
        predicate: () => app.workspace.getActiveViewOfType(obsidianModule.MarkdownView)?.file === sourceFile
      });

      const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
      if (!view) {
        throw new Error('The markdown editor closed again');
      }

      const editor = view.editor;
      await typeIntoEditor({ editor, text: `[[${query}` });

      await waitUntil({
        message: 'the link suggester to offer a suggestion',
        predicate: () => {
          const currentSuggest = app.workspace.editorSuggest.currentSuggest;
          return (currentSuggest?.isOpen ?? false) && (currentSuggest?.suggestions.values?.length ?? 0) > 0;
        }
      });

      await pressKey({ key: 'Enter' });
      await waitUntil({
        message: 'the link suggester to close',
        predicate: () => !app.workspace.editorSuggest.currentSuggest
      });
      await pressKey({ key: cursorMarker });
      await waitUntil({
        message: 'the cursor marker to be typed',
        predicate: () => editor.getValue().includes(cursorMarker)
      });

      return editor.getValue();
    },
    input: {
      cursorMarker: CURSOR_MARKER,
      linkStyleMode: params.linkStyleMode,
      pluginId: PLUGIN_ID,
      query: params.query,
      sourcePath: params.sourcePath,
      useMarkdownLinks: params.useMarkdownLinks
    },
    vaultPath: getTemporaryVault().path
  });
}
