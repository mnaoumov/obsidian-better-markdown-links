/**
 * @file
 *
 * Integration suite that verifies the `shouldNormalizeFileLinks` setting genuinely controls whether
 * `file://` links are normalized (decoding `%5C` and converting backslashes to forward slashes) when a
 * conversion is triggered, driving a real Obsidian instance:
 * - enabled: a body `file://` link with an encoded backslash is rewritten to forward slashes on the
 *   `Save current file` command, even though the note has no internal links to convert,
 * - disabled: the same `file://` link is left untouched.
 *
 * Each scenario uses its own source file so a pending async conversion never leaks between tests.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import type {
  MarkdownView,
  SettingTab,
  TFile
} from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from './plugin-settings.ts';

import { LinkConversionMode } from './link-conversion-mode.ts';

/**
 * The (otherwise protected) settings component exposed for the test, letting it change settings the
 * same way the plugin's own settings UI does.
 */
interface TestableSettingsComponent {
  editAndSave(settingsEditor: (settings: PluginSettings) => Promise<void> | void): Promise<void>;
}

/**
 * The plugin's settings tab, exposing its settings component.
 */
interface TestableSettingsTab extends SettingTab {
  readonly pluginSettingsComponent: TestableSettingsComponent;
}

const PLUGIN_ID = 'better-markdown-links';

// A body `file://` link whose path uses an encoded backslash (`%5C`); normalizing it decodes the
// Backslash and converts it to a forward slash, yielding an observably different string.
const UNNORMALIZED_CONTENT = '[body](file:///F:%5Cover%5Cage.txt)';
const NORMALIZED_MARKER = 'file:///F:/over/age.txt';
const ENCODED_BACKSLASH_MARKER = '%5C';

describe('normalize file links (Desktop)', () => {
  it('should normalize a body file:// link on the save command when enabled', async () => {
    const content = await runScenario({ shouldNormalizeFileLinks: true });

    expect(content).toContain(NORMALIZED_MARKER);
    expect(content).not.toContain(ENCODED_BACKSLASH_MARKER);
  });

  it('should leave a body file:// link unchanged when disabled', async () => {
    const content = await runScenario({ shouldNormalizeFileLinks: false });

    expect(content).toContain(ENCODED_BACKSLASH_MARKER);
    expect(content).not.toContain(NORMALIZED_MARKER);
  });
});

/**
 * Parameters for {@link runScenario}.
 */
interface RunScenarioParams {
  readonly shouldNormalizeFileLinks: boolean;
}

/**
 * Applies the given `shouldNormalizeFileLinks` setting (with the `OnSaveCommand` conversion mode), opens
 * a fresh source file with an un-normalized `file://` link typed in its editor, runs the save command,
 * waits for any normalization to settle, and returns the resulting on-disk content.
 *
 * @param params - See {@link RunScenarioParams}.
 * @returns The on-disk content of the source file after the save settles.
 */
async function runScenario(params: RunScenarioParams): Promise<string> {
  return evalInObsidian({
    args: {
      encodedBackslashMarker: ENCODED_BACKSLASH_MARKER,
      mode: LinkConversionMode.OnSaveCommand,
      normalizedMarker: NORMALIZED_MARKER,
      pluginId: PLUGIN_ID,
      shouldNormalizeFileLinks: params.shouldNormalizeFileLinks,
      sourcePath: `normalize-file-links-${String(params.shouldNormalizeFileLinks)}.md`,
      unnormalizedContent: UNNORMALIZED_CONTENT
    },
    async fn({ app, encodedBackslashMarker, mode, normalizedMarker, obsidianModule, pluginId, shouldNormalizeFileLinks, sourcePath, unnormalizedContent }): Promise<string> {
      const EDITOR_WAIT_ATTEMPTS = 50;
      const EDITOR_WAIT_INTERVAL_IN_MILLISECONDS = 50;
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 2500;
      const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkConversionMode = mode;
        settings.shouldNormalizeFileLinks = shouldNormalizeFileLinks;
        settings.shouldUseAngleBrackets = false;
      });

      const existing = app.vault.getAbstractFileByPath(sourcePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }

      const sourceFile = await app.vault.create(sourcePath, '');

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(sourceFile);

      const view = await waitForMarkdownView();
      // Typing the un-normalized link into the empty file dirties the editor so the save actually writes.
      view.editor.setValue(unnormalizedContent);

      app.commands.executeCommandById('editor:save-file');

      return waitForSettledContent(sourceFile);

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

      // Returns as soon as the link is normalized; otherwise waits the full timeout so the write has
      // Flushed and any (absent) normalization has had time to happen, then returns the on-disk content.
      async function waitForSettledContent(file: TFile): Promise<string> {
        const start = performance.now();
        let content = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          content = await app.vault.read(file);
          if (content.includes(normalizedMarker) && !content.includes(encodedBackslashMarker)) {
            return content;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return content;
      }
    },
    vaultPath: getTempVault().path
  });
}
