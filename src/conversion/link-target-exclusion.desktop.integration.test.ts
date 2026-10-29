/**
 * @file
 *
 * Integration suite for issue #45: a link whose TARGET matches `excludeLinkTargetPaths` is left exactly as
 * written, while every other link in the same note is still converted. It drives a real Obsidian instance
 * with Markdown links and the relative link format, excludes `*.base`, and checks every route a link can be
 * rewritten by:
 * - the `Save current file` command, which goes through the automatic-conversion probe and the converter,
 * - the `Convert links in current file` command, which also resolves unresolved wikilinks and would create
 *   the missing note an excluded `[[missing.base]]` names,
 * - the `Demote embeds to links in current file` command.
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

/**
 * What the scenario observed after the run settled.
 */
interface ScenarioResult {
  readonly content: string;
  readonly createdNotePaths: string[];
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
const SOURCE_PATH = 'link-target-exclusion.md';
const BASE_PATH = 'link-target-exclusion-table.base';
const NOTE_PATH = 'link-target-exclusion-note.md';
const PICTURE_PATH = 'link-target-exclusion-picture.png';

const BASE_EMBED = '![[link-target-exclusion-table.base]]';
const MISSING_BASE_LINK = '[[link-target-exclusion-missing.base]]';

/**
 * The value `<null>` for `commandId` saves the note with the `Save current file` command instead.
 */
const SAVE = null;

describe('link target exclusion (Desktop)', () => {
  it('should leave an excluded embed alone on save while converting the other links', async () => {
    const result = await runScenario({
      commandId: SAVE,
      content: `${BASE_EMBED}\n\n[[link-target-exclusion-note]]\n`,
      marker: '[link-target-exclusion-note](<./link-target-exclusion-note.md>)'
    });

    expect(result.content).toBe(`${BASE_EMBED}\n\n[link-target-exclusion-note](<./link-target-exclusion-note.md>)`);
  });

  it('should leave excluded links alone, and create no note for one, on the convert command', async () => {
    const result = await runScenario({
      commandId: `${PLUGIN_ID}:convert-links-in-current-file`,
      content: `${BASE_EMBED}\n\n${MISSING_BASE_LINK}\n\n[[link-target-exclusion-note]]\n`,
      marker: '[link-target-exclusion-note](<./link-target-exclusion-note.md>)'
    });

    expect(result.content).toBe(`${BASE_EMBED}\n\n${MISSING_BASE_LINK}\n\n[link-target-exclusion-note](<./link-target-exclusion-note.md>)`);
    expect(result.createdNotePaths).toEqual([]);
  });

  it('should keep an excluded embed an embed while demoting the others', async () => {
    const result = await runScenario({
      commandId: `${PLUGIN_ID}:demote-embeds-to-links-in-current-file`,
      content: `${BASE_EMBED}\n\n![[link-target-exclusion-picture.png]]\n`,
      marker: '\n[[link-target-exclusion-picture.png]]'
    });

    expect(result.content).toBe(`${BASE_EMBED}\n\n[[./link-target-exclusion-picture.png|link-target-exclusion-picture.png]]`);
  });
});

interface RunScenarioParams {
  readonly commandId: null | string;
  readonly content: string;

  /**
   * Text that appears once the run has rewritten what it should, which is what the scenario waits for.
   */
  readonly marker: string;
}

/**
 * Applies the settings, creates the targets, opens a fresh source note with `content` typed in, runs the
 * command (or saves), waits for `marker` to land on disk, and returns the note with every note it created.
 *
 * @param params - See {@link RunScenarioParams}.
 * @returns What the scenario observed.
 */
async function runScenario(params: RunScenarioParams): Promise<ScenarioResult> {
  return evalInObsidian({
    async callback({ app, basePath, commandId, content, marker, mode, notePath, obsidianModule, picturePath, pluginId, sourcePath }): Promise<ScenarioResult> {
      const EDITOR_WAIT_ATTEMPTS = 50;
      const EDITOR_WAIT_INTERVAL_IN_MILLISECONDS = 50;
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 5000;
      const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;

      app.vault.setConfig('useMarkdownLinks', true);
      app.vault.setConfig('newLinkFormat', 'relative');

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      try {
        await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
          settings.linkConversionMode = mode;
          settings.shouldUseAngleBrackets = true;
          settings.shouldUseLeadingDotForRelativePaths = true;
          settings.shouldCreateMissingNotes = true;
          settings.excludeLinkTargetPaths = ['*.base'];
        });

        await recreate(basePath, '');
        await recreate(notePath, 'Note\n');
        await recreate(picturePath, '');
        const sourceFile = await recreate(sourcePath, '');
        const pathsBefore = new Set(app.vault.getFiles().map((file) => file.path));

        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(sourceFile);
        const view = await waitForMarkdownView();
        // Typing into the empty file dirties the editor, so the save actually writes.
        view.editor.setValue(content);

        if (commandId === null) {
          app.commands.executeCommandById('editor:save-file');
        } else {
          // The commands read the metadata cache, so the typed content has to be on disk and indexed first.
          await view.save();
          await waitForIndexedReference(sourceFile);
          app.commands.executeCommandById(commandId);
        }

        const settledContent = await waitForMarker(sourceFile);
        return {
          content: settledContent.trim(),
          createdNotePaths: app.vault.getFiles().map((file) => file.path).filter((path) => !pathsBefore.has(path))
        };
      } finally {
        // Left in place, the exclusion and the note creation would leak into every later suite.
        await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
          settings.shouldCreateMissingNotes = false;
          settings.excludeLinkTargetPaths = [];
        });
      }

      async function recreate(path: string, fileContent: string): Promise<TFile> {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }

        return await app.vault.create(path, fileContent);
      }

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

      async function waitForIndexedReference(file: TFile): Promise<void> {
        const start = performance.now();
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          const cache = app.metadataCache.getFileCache(file);
          if ((cache?.links?.length ?? 0) + (cache?.embeds?.length ?? 0) > 0) {
            return;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        throw new Error(`Metadata cache never indexed a reference in ${file.path}`);
      }

      // Returns as soon as the marker is on disk; otherwise returns the on-disk content after the timeout.
      async function waitForMarker(file: TFile): Promise<string> {
        const start = performance.now();
        let fileContent = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          fileContent = await app.vault.read(file);
          if (fileContent.includes(marker)) {
            return fileContent;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return fileContent;
      }
    },
    input: {
      basePath: BASE_PATH,
      commandId: params.commandId,
      content: params.content,
      marker: params.marker,
      mode: params.commandId === SAVE ? LinkConversionMode.OnSaveCommand : LinkConversionMode.OnExplicitCommand,
      notePath: NOTE_PATH,
      picturePath: PICTURE_PATH,
      pluginId: PLUGIN_ID,
      sourcePath: SOURCE_PATH
    },
    vaultPath: getTemporaryVault().path
  });
}
