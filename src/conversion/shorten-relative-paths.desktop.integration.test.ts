/**
 * @file
 *
 * Integration suite for shortening a relative link path that climbs out of its folders and back into them.
 * From `alpha/bravo/charlie.md`, `[[../../alpha/bravo/delta]]` names the same note as `[[./delta]]`, and every
 * conversion surface writes the shorter form, for wikilinks and Markdown links alike:
 * - the `Convert link paths to relative in current file` command, whatever Obsidian's `New link format` says,
 * - the `Convert links in current file` command, under Obsidian's relative `New link format`,
 * - the `Save current file` command, through the automatic conversion's probe.
 *
 * The leading dot is the plugin's `shouldUseLeadingDotForRelativePaths` setting, so a shortened link stays
 * visibly relative rather than becoming the bare `[[delta]]` of the shortest-path style.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import type {
  MarkdownView,
  SettingTab,
  TFile
} from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from '../settings/plugin-settings.ts';

import { LinkConversionMode } from '../settings/link-conversion-mode.ts';
import { LinkStyleMode } from '../settings/link-style-mode.ts';

/**
 * Parameters for {@link runScenario}.
 */
interface RunScenarioParams {
  readonly commandId: string;
  readonly newLinkFormat: 'absolute' | 'relative' | 'shortest';
  readonly sourcePath: string;
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
const TARGET_PATH = 'alpha/bravo/delta.md';

const UNCONVERTED_CONTENT = `[[../../alpha/bravo/delta]]

[delta](<../../alpha/bravo/delta.md>)
`;

const SHORTENED_CONTENT = `[[./delta]]

[delta](<./delta.md>)
`;

describe('shortening relative link paths (Desktop)', () => {
  it('should shorten through the convert link paths to relative command', async () => {
    const content = await runScenario({
      commandId: `${PLUGIN_ID}:convert-link-paths-to-relative-in-current-file`,
      newLinkFormat: 'shortest',
      sourcePath: 'alpha/bravo/charlie-relative-command.md'
    });

    expect(content).toBe(SHORTENED_CONTENT);
  });

  it('should shorten through the convert links command under the relative link format', async () => {
    const content = await runScenario({
      commandId: `${PLUGIN_ID}:convert-links-in-current-file`,
      newLinkFormat: 'relative',
      sourcePath: 'alpha/bravo/charlie-convert-command.md'
    });

    expect(content).toBe(SHORTENED_CONTENT);
  });

  it('should shorten on the save command under the relative link format', async () => {
    const content = await runScenario({
      commandId: 'editor:save-file',
      newLinkFormat: 'relative',
      sourcePath: 'alpha/bravo/charlie-save.md'
    });

    expect(content).toBe(SHORTENED_CONTENT);
  });
});

/**
 * Applies the settings, creates the target and a fresh source note, types the long relative links into its
 * editor, runs the command, and returns the on-disk content once it is shortened or the wait times out.
 *
 * @param params - See {@link RunScenarioParams}.
 * @returns The source note's content after the command.
 */
async function runScenario(params: RunScenarioParams): Promise<string> {
  return evalInObsidian({
    async callback({ app, commandId, linkStyleMode, mode, newLinkFormat, obsidianModule, pluginId, shortenedContent, sourcePath, targetPath, unconvertedContent }): Promise<string> {
      const EDITOR_WAIT_ATTEMPTS = 50;
      const EDITOR_WAIT_INTERVAL_IN_MILLISECONDS = 50;
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 5000;
      const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;

      app.vault.setConfig('useMarkdownLinks', false);
      app.vault.setConfig('newLinkFormat', newLinkFormat);

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkConversionMode = mode;
        // Each link keeps its own style, so the wikilink and the Markdown link are both asserted on their path alone.
        settings.linkStyleMode = linkStyleMode;
        settings.shouldUseAngleBrackets = true;
        // Pinned, because the shortened links are asserted with their dot and an earlier suite may have switched it off.
        settings.shouldUseLeadingDotForRelativePaths = true;
      });

      for (const path of [sourcePath, targetPath]) {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }
      }

      if (!app.vault.getAbstractFileByPath('alpha/bravo')) {
        await app.vault.createFolder('alpha/bravo');
      }

      await app.vault.create(targetPath, 'Delta\n');
      const sourceFile = await app.vault.create(sourcePath, '');

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(sourceFile);

      const view = await waitForMarkdownView();
      // Typing the links into the empty file dirties the editor so the save actually writes.
      view.editor.setValue(unconvertedContent);

      app.commands.executeCommandById(commandId);

      return await waitForShortenedContent(sourceFile);

      async function waitForMarkdownView(): Promise<MarkdownView> {
        for (let attempt = 0; attempt < EDITOR_WAIT_ATTEMPTS; attempt++) {
          const activeView = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
          if (activeView?.editor) {
            return activeView;
          }

          await sleep(EDITOR_WAIT_INTERVAL_IN_MILLISECONDS);
        }

        throw new Error('Markdown editor did not become active');
      }

      // Returns as soon as the links are shortened; otherwise returns the on-disk content after the timeout.
      async function waitForShortenedContent(file: TFile): Promise<string> {
        const start = performance.now();
        let fileContent = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          fileContent = await app.vault.read(file);
          if (fileContent === shortenedContent) {
            return fileContent;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return fileContent;
      }
    },
    input: {
      commandId: params.commandId,
      linkStyleMode: LinkStyleMode.PreserveExisting,
      mode: LinkConversionMode.OnSaveCommand,
      newLinkFormat: params.newLinkFormat,
      pluginId: PLUGIN_ID,
      shortenedContent: SHORTENED_CONTENT,
      sourcePath: params.sourcePath,
      targetPath: TARGET_PATH,
      unconvertedContent: UNCONVERTED_CONTENT
    },
    vaultPath: getTemporaryVault().path
  });
}
