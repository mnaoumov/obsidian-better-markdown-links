/**
 * @file
 *
 * Integration suite for issue #40, driving a real Obsidian instance.
 *
 * Another plugin may rewrite the editor immediately after the `editor:save-file` command has run —
 * Linter's `Lint on save` with `Insert YAML attributes` does exactly that, synchronously, right after it
 * has called the original save callback. Whatever that write inserts has to stay visible in the editor.
 *
 * This plugin's automatic conversion reacts to the same save, so its work overlaps that write. It broke
 * this: the automatic probe asked for the note's cached metadata, which first flushes every dirty
 * `MarkdownView` of the note, so the foreign insert was saved a second time one tick after it landed and
 * Obsidian's properties section in the editor was left rendering the frontmatter from before it —
 * nothing — until the note was closed and reopened. On disk, in the metadata cache and in the File
 * properties view the attributes were all present, which is what made it look like a Linter bug.
 *
 * The scenarios drive a Linter-shaped stub rather than Linter itself, so the suite needs no third-party
 * plugin in the vault: what matters is only the shape — patch the save command, call the original
 * callback, then synchronously dispatch frontmatter into the editor.
 *
 * The note deliberately has NO links in it, matching the report: nothing is converted in any mode, so
 * every failure this suite can produce is about the probe's side effects rather than about conversion.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import type {
  MarkdownView,
  SettingTab
} from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from './plugin-settings.ts';

import { LinkConversionMode } from './link-conversion-mode.ts';

/**
 * What one scenario observes after the save has settled.
 */
interface ForeignWriteScenarioResult {
  readonly diskContent: string;
  readonly propertyKeys: string[];
}

/**
 * The (otherwise protected) settings component exposed for the test, letting it change settings the
 * same way the plugin's own settings UI does.
 */
interface TestableSettingsComponent {
  editAndSave: (settingsEditor: (settings: PluginSettings) => Promise<void> | void) => Promise<void>;
}

/**
 * The plugin's settings tab, exposing its settings component.
 */
interface TestableSettingsTab extends SettingTab {
  readonly pluginSettingsComponent: TestableSettingsComponent;
}

const PLUGIN_ID = 'better-markdown-links';

/**
 * The property key the Linter-shaped stub inserts, and the frontmatter block carrying it.
 */
const INSERTED_PROPERTY_KEY = 'inserted-by-another-plugin';
const INSERTED_FRONTMATTER = `---\n${INSERTED_PROPERTY_KEY}: yes\n---\n`;

describe('a foreign editor write right after the save command (Desktop)', () => {
  it('should stay visible in the properties section in the OnSaveCommand mode', async () => {
    const result = await runForeignWriteScenario(LinkConversionMode.OnSaveCommand);

    expect(result.propertyKeys).toContain(INSERTED_PROPERTY_KEY);
  });

  it('should stay visible in the properties section in the OnAutoSave mode', async () => {
    const result = await runForeignWriteScenario(LinkConversionMode.OnAutoSave);

    expect(result.propertyKeys).toContain(INSERTED_PROPERTY_KEY);
  });

  // The control: the modes that never react to a save were the ones the report found working, so a
  // failure here means the stub itself is wrong rather than this plugin.
  it('should stay visible in the properties section in the OnExplicitCommand mode', async () => {
    const result = await runForeignWriteScenario(LinkConversionMode.OnExplicitCommand);

    expect(result.propertyKeys).toContain(INSERTED_PROPERTY_KEY);
  });

  it('should reach the note on disk in the OnSaveCommand mode', async () => {
    const result = await runForeignWriteScenario(LinkConversionMode.OnSaveCommand);

    // Pinned separately because it was never the broken half: the report's whole difficulty was that the
    // attributes WERE written. A regression that lost them would be a different, louder defect.
    expect(result.diskContent).toContain(`${INSERTED_PROPERTY_KEY}: yes`);
  });
});

/**
 * Applies the given link conversion mode, opens a fresh link-free note, installs a Linter-shaped save
 * hook that rewrites the editor right after the save, runs the save command, and reports what the
 * editor's properties section ended up rendering.
 *
 * @param mode - The link conversion mode to apply before saving.
 * @returns See {@link ForeignWriteScenarioResult}.
 */
async function runForeignWriteScenario(mode: LinkConversionMode): Promise<ForeignWriteScenarioResult> {
  return evalInObsidian({
    async callback({ app, insertedFrontmatter, insertedPropertyKey, mode: mode2, obsidianModule, pluginId, sourcePath }): Promise<ForeignWriteScenarioResult> {
      const EDITOR_SETTLE_IN_MILLISECONDS = 200;
      const EDITOR_WAIT_ATTEMPTS = 50;
      const EDITOR_WAIT_INTERVAL_IN_MILLISECONDS = 50;
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 5000;
      const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkConversionMode = mode2;
      });

      const existing = app.vault.getAbstractFileByPath(sourcePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }

      const sourceFile = await app.vault.create(sourcePath, '');
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(sourceFile);

      const view = await waitForMarkdownView();
      // Typing into the empty note dirties the editor so the save actually writes.
      view.editor.setValue('# a note with no links in it\n');
      // Let the freshly opened note settle before the save, so the save the scenario triggers is the only
      // one in flight. Without it Obsidian's own post-open bookkeeping masks the defect entirely: the
      // suite then passes against the broken plugin too, which is how this line came to be here.
      await sleep(EDITOR_SETTLE_IN_MILLISECONDS);

      const command = app.commands.commands['editor:save-file'];
      const originalCheckCallback = command?.checkCallback?.bind(command);
      if (!command || !originalCheckCallback) {
        throw new Error('The editor:save-file command has no checkCallback to patch');
      }

      command.checkCallback = (isChecking: boolean): boolean => {
        if (isChecking) {
          return originalCheckCallback(isChecking) === true;
        }

        originalCheckCallback(isChecking);
        // The Linter-shaped half: a synchronous CodeMirror dispatch right after the original save
        // callback returns, bypassing the transaction filter the way Linter does.
        if (!view.editor.getValue().startsWith('---')) {
          view.editor.cm.dispatch({
            changes: [{
              from: 0,
              insert: insertedFrontmatter
            }],
            filter: false
          });
        }

        // Obsidian ignores what the execute branch answers; `false` only satisfies the declared type.
        return false;
      };

      try {
        app.commands.executeCommandById('editor:save-file');

        const propertyKeys = await waitForRenderedPropertyKeys();
        return {
          diskContent: await waitForSettledContent(),
          propertyKeys
        };
      } finally {
        command.checkCallback = originalCheckCallback;
      }

      /**
       * The property keys the editor's own properties section is rendering.
       *
       * @returns One entry per rendered row.
       */
      function readRenderedPropertyKeys(): string[] {
        return [...view.contentEl.querySelectorAll<HTMLElement>('.metadata-property')]
          .map((propertyEl) => propertyEl.dataset['propertyKey'] ?? '');
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

      // Returns as soon as the inserted key is rendered; otherwise waits the full timeout so a late
      // re-render still counts, then returns whatever is there for the assertion to report.
      async function waitForRenderedPropertyKeys(): Promise<string[]> {
        const start = performance.now();
        let propertyKeys = readRenderedPropertyKeys();
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          propertyKeys = readRenderedPropertyKeys();
          if (propertyKeys.includes(insertedPropertyKey)) {
            return propertyKeys;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return propertyKeys;
      }

      // Returns as soon as the insert reaches the note. Obsidian's own debounced auto-save is what
      // writes it now; this plugin used to force that write itself, which is the defect.
      async function waitForSettledContent(): Promise<string> {
        const start = performance.now();
        let content = await app.vault.read(sourceFile);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          content = await app.vault.read(sourceFile);
          if (content.includes(insertedPropertyKey)) {
            return content;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return content;
      }
    },
    input: {
      insertedFrontmatter: INSERTED_FRONTMATTER,
      insertedPropertyKey: INSERTED_PROPERTY_KEY,
      mode,
      pluginId: PLUGIN_ID,
      sourcePath: `foreign-editor-write-${mode}.md`
    },
    vaultPath: getTemporaryVault().path
  });
}
