/**
 * @file
 *
 * Integration suite that verifies the `shouldNormalizeFileLinks` setting genuinely controls whether
 * `file://` links are normalized (decoding `%5C` and converting backslashes to forward slashes) when a
 * conversion is triggered, driving a real Obsidian instance:
 * - enabled: a body `file://` link with an encoded backslash is rewritten to forward slashes on the
 *   `Save current file` command, even though the note has no internal links to convert,
 * - enabled: `file://` links inside a multi-link frontmatter value are likewise normalized,
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

// `file://` links whose paths use encoded backslashes (`%5C`); normalizing decodes them and converts
// The backslashes to forward slashes, yielding an observably different string.
const BODY_CONTENT = '[body](file:///F:%5Cover%5Cage.txt)';
const FRONTMATTER_MULTI_LINK_CONTENT = '---\nkey: "file:///F:%5Cover%5Care.txt file:///F:%5Cover%5Cage.txt"\n---\n\nbody\n';
const ENCODED_BACKSLASH_MARKER = '%5C';

describe('normalize file links (Desktop)', () => {
  it('should normalize a body file:// link on the save command when enabled', async () => {
    const content = await runScenario({
      content: BODY_CONTENT,
      shouldNormalizeFileLinks: true,
      sourceKey: 'body-enabled'
    });

    expect(content).toContain('file:///F:/over/age.txt');
    expect(content).not.toContain(ENCODED_BACKSLASH_MARKER);
  });

  it('should normalize file:// links in a multi-link frontmatter value on the save command when enabled', async () => {
    const content = await runScenario({
      content: FRONTMATTER_MULTI_LINK_CONTENT,
      shouldNormalizeFileLinks: true,
      sourceKey: 'frontmatter-multi-link'
    });

    expect(content).toContain('file:///F:/over/are.txt');
    expect(content).toContain('file:///F:/over/age.txt');
    expect(content).not.toContain(ENCODED_BACKSLASH_MARKER);
  });

  it('should leave a body file:// link unchanged when disabled', async () => {
    const content = await runScenario({
      content: BODY_CONTENT,
      shouldNormalizeFileLinks: false,
      sourceKey: 'body-disabled'
    });

    expect(content).toContain(ENCODED_BACKSLASH_MARKER);
    expect(content).not.toContain('file:///F:/over/age.txt');
  });
});

/**
 * Parameters for {@link runScenario}.
 */
interface RunScenarioParams {
  readonly content: string;
  readonly shouldNormalizeFileLinks: boolean;
  readonly sourceKey: string;
}

/**
 * Applies the given `shouldNormalizeFileLinks` setting (with the `OnSaveCommand` conversion mode), opens
 * a fresh source file with the given un-normalized `file://` content typed in its editor, runs the save
 * command, waits for any normalization to settle, and returns the resulting on-disk content.
 *
 * @param params - See {@link RunScenarioParams}.
 * @returns The on-disk content of the source file after the save settles.
 */
async function runScenario(params: RunScenarioParams): Promise<string> {
  return evalInObsidian({
    args: {
      content: params.content,
      encodedBackslashMarker: ENCODED_BACKSLASH_MARKER,
      mode: LinkConversionMode.OnSaveCommand,
      pluginId: PLUGIN_ID,
      shouldNormalizeFileLinks: params.shouldNormalizeFileLinks,
      sourcePath: `normalize-file-links-${params.sourceKey}.md`
    },
    async fn({ app, content, encodedBackslashMarker, mode, obsidianModule, pluginId, shouldNormalizeFileLinks, sourcePath }): Promise<string> {
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
      // Typing the un-normalized content into the empty file dirties the editor so the save actually writes.
      view.editor.setValue(content);

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

      // Returns as soon as the links are normalized (no encoded backslash remains); otherwise waits the
      // Full timeout so the write has flushed and any (absent) normalization has had time to happen, then
      // Returns the on-disk content.
      async function waitForSettledContent(file: TFile): Promise<string> {
        const start = performance.now();
        let fileContent = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          fileContent = await app.vault.read(file);
          if (!fileContent.includes(encodedBackslashMarker)) {
            return fileContent;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return fileContent;
      }
    },
    vaultPath: getTempVault().path
  });
}
