/**
 * @file
 *
 * Integration suite that verifies the `linkConversionMode` setting genuinely controls WHEN links are
 * automatically converted, driving a real Obsidian instance:
 * - the `Save current file` command (usually `Ctrl + S`) converts in the `OnSaveCommand` mode,
 * - Obsidian's implicit auto-save (a direct `TextFileView.save()`) does NOT convert in that mode,
 * - the `OnAutoSave` mode converts on that same auto-save,
 * - the `OnExplicitCommand` mode never auto-converts, even via the save command.
 *
 * Each scenario uses its own source file so a save-command tag or a pending async conversion never
 * leaks between tests.
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
  beforeAll,
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
const TARGET_PATH = 'convert-on-save target.md';

// A percent-encoded link (no angle brackets) to a space-containing file; converting it to the configured angle-bracket style yields an observably different string.
const UNCONVERTED_CONTENT = '[link](/convert-on-save%20target.md)';
const CONVERTED_MARKER = '[link](</convert-on-save target.md>)';
const ENCODED_MARKER = '%20';

/**
 * Parameters for {@link runSaveScenario}.
 */
interface RunSaveScenarioParams {
  readonly mode: LinkConversionMode;
  readonly trigger: SaveTrigger;
}

/**
 * How the file is saved after its editor content is set.
 * - `command` runs the `editor:save-file` command (the `Ctrl + S` path).
 * - `auto-save` calls `TextFileView.save()` directly (the implicit auto-save path).
 */
type SaveTrigger = 'auto-save' | 'command';

describe('convert on save (Desktop)', () => {
  beforeAll(async () => {
    await evalInObsidian({
      args: { targetPath: TARGET_PATH },
      async fn({ app, targetPath }) {
        app.vault.setConfig('useMarkdownLinks', true);
        app.vault.setConfig('newLinkFormat', 'absolute');

        const existing = app.vault.getAbstractFileByPath(targetPath);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }

        await app.vault.create(targetPath, '# target');
      },
      vaultPath: getTempVault().path
    });
  });

  it('should convert on the save-file command in the OnSaveCommand mode', async () => {
    const content = await runSaveScenario({ mode: LinkConversionMode.OnSaveCommand, trigger: 'command' });

    expect(content).toContain(CONVERTED_MARKER);
    expect(content).not.toContain(ENCODED_MARKER);
  });

  it('should not convert on auto-save in the OnSaveCommand mode', async () => {
    const content = await runSaveScenario({ mode: LinkConversionMode.OnSaveCommand, trigger: 'auto-save' });

    expect(content).toContain(ENCODED_MARKER);
    expect(content).not.toContain(CONVERTED_MARKER);
  });

  it('should convert on auto-save in the OnAutoSave mode', async () => {
    const content = await runSaveScenario({ mode: LinkConversionMode.OnAutoSave, trigger: 'auto-save' });

    expect(content).toContain(CONVERTED_MARKER);
    expect(content).not.toContain(ENCODED_MARKER);
  });

  it('should not convert on the save-file command in the OnExplicitCommand mode', async () => {
    const content = await runSaveScenario({ mode: LinkConversionMode.OnExplicitCommand, trigger: 'command' });

    expect(content).toContain(ENCODED_MARKER);
    expect(content).not.toContain(CONVERTED_MARKER);
  });
});

/**
 * Applies the given link conversion mode, opens a fresh source file with an unconverted link typed in
 * its editor, triggers the given save, waits for any conversion to settle, and returns the resulting
 * on-disk content.
 *
 * @param params - See {@link RunSaveScenarioParams}.
 * @returns The on-disk content of the source file after the save settles.
 */
async function runSaveScenario(params: RunSaveScenarioParams): Promise<string> {
  return evalInObsidian({
    args: {
      convertedMarker: CONVERTED_MARKER,
      mode: params.mode,
      pluginId: PLUGIN_ID,
      sourcePath: `convert-on-save-${params.mode}-${params.trigger}.md`,
      trigger: params.trigger,
      unconvertedContent: UNCONVERTED_CONTENT
    },
    async fn({ app, convertedMarker, mode, obsidianModule, pluginId, sourcePath, trigger, unconvertedContent }): Promise<string> {
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
        settings.shouldUseAngleBrackets = true;
        settings.shouldUseLeadingSlashForAbsolutePaths = true;
      });

      const existing = app.vault.getAbstractFileByPath(sourcePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }

      const sourceFile = await app.vault.create(sourcePath, '');

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(sourceFile);

      const view = await waitForMarkdownView();
      // Typing the unconverted link into the empty file dirties the editor so the save actually writes.
      view.editor.setValue(unconvertedContent);

      if (trigger === 'command') {
        app.commands.executeCommandById('editor:save-file');
      } else {
        await view.save();
      }

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

      // Returns as soon as the link is converted; otherwise waits the full timeout so the write has
      // Flushed and any (absent) conversion has had time to happen, then returns the on-disk content.
      async function waitForSettledContent(file: TFile): Promise<string> {
        const start = performance.now();
        let content = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          content = await app.vault.read(file);
          if (content.includes(convertedMarker)) {
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
