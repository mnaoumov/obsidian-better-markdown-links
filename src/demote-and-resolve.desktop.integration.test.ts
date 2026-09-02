/**
 * @file
 *
 * Integration suite for the two conversions added by T697, driving a real Obsidian instance:
 * - demoting embeds to links, with and without the `shouldAppendFileNameWhenDemotingEmbeds` sub-bullet,
 * - resolving an alias-only wikilink through another note's `aliases` frontmatter,
 * - creating the note behind a wikilink that resolves to nothing,
 * - and the invariant that makes the last one safe: the AUTOMATIC conversion paths must never create a
 *   note, however the settings are set, because they fire on every save.
 *
 * It also covers the force-Markdown link style added by T845, both as a setting and as its own command,
 * against a vault whose own `Use [[Wikilinks]]` setting is on — the one thing no unit test can prove.
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
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from './plugin-settings.ts';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { LinkStyleMode } from './link-style-mode.ts';

/**
 * Parameters for {@link runScenario}.
 */
interface RunScenarioParams {
  readonly commandId: string;
  /**
   * Extra notes to create before the source file, as path to content. Used for embed targets and for
   * the note an alias is meant to resolve to.
   */
  readonly companions?: Record<string, string>;
  readonly content: string;
  readonly settings: ScenarioSettings;
  /**
   * A substring whose DISAPPEARANCE means the conversion has settled. Preferred over the appearance marker
   * whenever the converted form is a SUBSTRING of the original (`![](<x>)` contains `[](<x>)`), where an
   * appearance marker matches the unconverted content and the wait returns immediately.
   */
  readonly settledAbsentMarker?: string;

  /**
   * A substring whose APPEARANCE means the conversion has settled. When neither marker is given, the
   * helper waits the full settle timeout — which is what a "nothing should happen" assertion needs.
   */
  readonly settledMarker?: string;

  readonly sourceKey: string;
}

/**
 * What a scenario observed after the command settled.
 */
interface ScenarioResult {
  readonly content: string;
  readonly createdNotePaths: string[];
}

/**
 * Settings this suite varies. Everything else is left at whatever the scenario helper pins.
 */
interface ScenarioSettings {
  readonly linkConversionMode?: LinkConversionMode;
  readonly linkStyleMode?: LinkStyleMode;
  readonly shouldAppendFileNameWhenDemotingEmbeds?: boolean;
  readonly shouldCreateMissingNotes?: boolean;
  readonly shouldResolveLinksViaAliases?: boolean;
}

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
const DEMOTE_COMMAND_ID = `${PLUGIN_ID}:demote-embeds-to-links-in-current-file`;
const CONVERT_COMMAND_ID = `${PLUGIN_ID}:convert-links-in-current-file`;
const SAVE_COMMAND_ID = 'editor:save-file';

const ALIASED_NOTE_PATH = 'Aliased target.md';
const ALIASED_NOTE_CONTENT = '---\naliases:\n  - The Simple One\n---\n\nbody\n';
const EMBED_TARGET_PATH = 'Embed target.md';

describe('demote embeds and resolve unresolved links (Desktop)', () => {
  describe('demoting embeds', () => {
    it('should turn an embed into a plain link, filling in the alias an empty embed did not need', async () => {
      const result = await runScenario({
        commandId: DEMOTE_COMMAND_ID,
        companions: { [EMBED_TARGET_PATH]: 'body\n' },
        content: `![](<${EMBED_TARGET_PATH}>)`,
        settings: {},
        settledAbsentMarker: '!',
        sourceKey: 'demote-plain'
      });

      // An embed with an empty alias renders its target inline, so it needs no text; the link it becomes
      // Would render as nothing at all, so the target's basename is filled in.
      expect(result.content).toBe('[Embed target](<Embed target.md>)');
    });

    it('should keep the alias while demoting', async () => {
      const result = await runScenario({
        commandId: DEMOTE_COMMAND_ID,
        companions: { [EMBED_TARGET_PATH]: 'body\n' },
        content: `![The target](<${EMBED_TARGET_PATH}>)`,
        settings: {},
        settledAbsentMarker: '!',
        sourceKey: 'demote-alias'
      });

      expect(result.content).toContain(`[The target](<${EMBED_TARGET_PATH}>)`);
      expect(result.content).not.toContain('![');
    });

    it('should append the target file name as a sub-bullet when the setting is enabled', async () => {
      const result = await runScenario({
        commandId: DEMOTE_COMMAND_ID,
        companions: { [EMBED_TARGET_PATH]: 'body\n' },
        content: `![](<${EMBED_TARGET_PATH}>)`,
        settings: { shouldAppendFileNameWhenDemotingEmbeds: true },
        settledMarker: '  - Embed target.md',
        sourceKey: 'demote-sub-bullet'
      });

      expect(result.content).toContain('  - Embed target.md');
    });

    it('should leave a plain link alone', async () => {
      const result = await runScenario({
        commandId: DEMOTE_COMMAND_ID,
        companions: { [EMBED_TARGET_PATH]: 'body\n' },
        content: `[](<${EMBED_TARGET_PATH}>)`,
        settings: {},
        sourceKey: 'demote-noop'
      });

      expect(result.content).toBe(`[](<${EMBED_TARGET_PATH}>)`);
    });
  });

  describe('resolving unresolved links', () => {
    it('should resolve an alias-only wikilink through the aliases frontmatter', async () => {
      const result = await runScenario({
        commandId: CONVERT_COMMAND_ID,
        companions: { [ALIASED_NOTE_PATH]: ALIASED_NOTE_CONTENT },
        content: '[[The Simple One]]',
        settings: { shouldResolveLinksViaAliases: true },
        settledMarker: 'Aliased target',
        sourceKey: 'resolve-alias'
      });

      expect(result.content).toContain('Aliased target');
      expect(result.createdNotePaths).toHaveLength(0);
    });

    it('should create the note behind a wikilink that resolves to nothing', async () => {
      const result = await runScenario({
        commandId: CONVERT_COMMAND_ID,
        content: '[[A brand new note]]',
        settings: { shouldCreateMissingNotes: true },
        sourceKey: 'resolve-create'
      });

      expect(result.createdNotePaths).toContain('A brand new note.md');
      // Deliberately NOT asserting the link became a markdown link. The conversion runs at
      // `LinkStyle.ObsidianSettingsDefault`, and the test vault leaves Obsidian's own `Use [[Wikilinks]]`
      // Setting on, so the link correctly stays a wikilink - pointed at the new note, not restyled. The
      // `forcing the markdown link style` scenarios below are the ones that override that setting.
    });

    it('should leave an unresolved wikilink alone when both settings are disabled', async () => {
      const result = await runScenario({
        commandId: CONVERT_COMMAND_ID,
        content: '[[A note nobody asked for]]',
        settings: {},
        sourceKey: 'resolve-disabled'
      });

      expect(result.createdNotePaths).toHaveLength(0);
    });
  });

  // The capability inherited from Consistent Attachments and Links: writing markdown links even in a vault
  // Whose own `Use [[Wikilinks]]` setting says otherwise. The test vault leaves that setting ON, so a
  // Wikilink surviving as a wikilink is the baseline these two scenarios have to beat.
  describe('forcing the markdown link style', () => {
    it('should leave a wikilink alone when the link style follows the Obsidian setting', async () => {
      const result = await runScenario({
        commandId: CONVERT_COMMAND_ID,
        companions: { [EMBED_TARGET_PATH]: 'body\n' },
        content: '[[Embed target]]',
        settings: {},
        sourceKey: 'link-style-baseline'
      });

      expect(result.content).toBe('[[Embed target]]');
    });

    it('should force markdown for one run via the convert-to-markdown command', async () => {
      const result = await runScenario({
        commandId: `${PLUGIN_ID}:convert-links-to-markdown-in-current-file`,
        companions: { [EMBED_TARGET_PATH]: 'body\n' },
        content: '[[Embed target]]',
        settings: {},
        settledMarker: '](',
        sourceKey: 'link-style-command'
      });

      expect(result.content).toContain(`](<${EMBED_TARGET_PATH}>)`);
      expect(result.content).not.toContain('[[');
    });

    it('should force markdown on the plain convert command when the Markdown link style is selected', async () => {
      const result = await runScenario({
        commandId: CONVERT_COMMAND_ID,
        companions: { [EMBED_TARGET_PATH]: 'body\n' },
        content: '[[Embed target]]',
        settings: { linkStyleMode: LinkStyleMode.Markdown },
        settledMarker: '](',
        sourceKey: 'link-style-setting'
      });

      expect(result.content).toContain(`](<${EMBED_TARGET_PATH}>)`);
      expect(result.content).not.toContain('[[');
    });
  });

  // The reason `shouldCreateMissingNotes` is safe to offer at all: it is wired to the explicit convert
  // Commands only. Were it reachable from the automatic paths, every auto-save on a note with a typo'd
  // Wikilink would silently add a file to the vault.
  it('should never create a note on the automatic save path, even with creation enabled', async () => {
    const result = await runScenario({
      commandId: SAVE_COMMAND_ID,
      content: '[[A note the save must not create]]',
      settings: {
        linkConversionMode: LinkConversionMode.OnAutoSave,
        shouldCreateMissingNotes: true,
        shouldResolveLinksViaAliases: true
      },
      sourceKey: 'automatic-path-creates-nothing'
    });

    expect(result.createdNotePaths).toHaveLength(0);
  });
});

/**
 * Applies the scenario's settings, creates its companion notes, opens a fresh source file with the
 * given content typed into its editor, runs the scenario's command, waits for it to settle, and
 * reports both the resulting on-disk content and any notes that appeared in the vault.
 *
 * @param params - See {@link RunScenarioParams}.
 * @returns See {@link ScenarioResult}.
 */
async function runScenario(params: RunScenarioParams): Promise<ScenarioResult> {
  return evalInObsidian({
    async callback({ app, commandId, companions, content, explicitCommandMode, obsidianModule, obsidianSettingsDefaultStyle, pluginId, settings, settledAbsentMarker, settledMarker, sourcePath }): Promise<ScenarioResult> {
      const EDITOR_WAIT_ATTEMPTS = 50;
      const EDITOR_WAIT_INTERVAL_IN_MILLISECONDS = 50;
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 3000;
      const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((pluginSettings) => {
        // Pinned so the scenarios assert the conversion, not the ambient link style.
        pluginSettings.linkConversionMode = settings.linkConversionMode ?? explicitCommandMode;
        pluginSettings.linkStyleMode = settings.linkStyleMode ?? obsidianSettingsDefaultStyle;
        pluginSettings.shouldUseAngleBrackets = true;
        pluginSettings.shouldAppendFileNameWhenDemotingEmbeds = settings.shouldAppendFileNameWhenDemotingEmbeds ?? false;
        pluginSettings.shouldCreateMissingNotes = settings.shouldCreateMissingNotes ?? false;
        pluginSettings.shouldResolveLinksViaAliases = settings.shouldResolveLinksViaAliases ?? false;
      });

      for (const [companionPath, companionContent] of Object.entries(companions)) {
        await recreate(companionPath, companionContent);
      }

      const sourceFile = await recreate(sourcePath, '');
      // Captured before any editing, so a note created at ANY point in the scenario is caught.
      const pathsBefore = new Set(app.vault.getMarkdownFiles().map((file) => file.path));

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(sourceFile);

      const view = await waitForMarkdownView();
      // Typing into the empty file dirties the editor, so a save-command scenario actually writes.
      view.editor.setValue(content);

      // Both commands work off the metadata cache, so the typed content has to be on disk AND indexed
      // Before the command runs. Without this the command sees a file with no references and no-ops,
      // Which reads as "the feature is broken" only intermittently — whichever way the race lands.
      await view.save();
      await waitForIndexedReference(sourceFile);

      app.commands.executeCommandById(commandId);

      const settledContent = await waitForSettledContent(sourceFile);
      const createdNotePaths = app.vault.getMarkdownFiles()
        .map((file) => file.path)
        .filter((path) => !pathsBefore.has(path));

      return {
        content: settledContent.trim(),
        createdNotePaths
      };

      async function recreate(path: string, fileContent: string): Promise<TFile> {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }

        return await app.vault.create(path, fileContent);
      }

      // Polls until Obsidian's metadata cache reports the link or embed that was just typed. Every
      // Scenario writes exactly one reference, so "at least one" is the whole condition.
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

      // Returns as soon as the marker appears; with no marker (a "nothing should happen" scenario) it
      // Waits the full timeout, so the assertion is made after the conversion has had every chance to run.
      async function waitForSettledContent(file: TFile): Promise<string> {
        const start = performance.now();
        let fileContent = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          fileContent = await app.vault.read(file);
          if (settledMarker && fileContent.includes(settledMarker)) {
            return fileContent;
          }

          if (settledAbsentMarker && !fileContent.includes(settledAbsentMarker)) {
            return fileContent;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return fileContent;
      }
    },
    input: {
      commandId: params.commandId,
      companions: params.companions ?? {},
      content: params.content,
      explicitCommandMode: LinkConversionMode.OnExplicitCommand,
      obsidianSettingsDefaultStyle: LinkStyleMode.ObsidianSettingsDefault,
      pluginId: PLUGIN_ID,
      settings: params.settings,
      settledAbsentMarker: params.settledAbsentMarker ?? '',
      settledMarker: params.settledMarker ?? '',
      sourcePath: `demote-and-resolve-${params.sourceKey}.md`
    },
    vaultPath: getTemporaryVault().path
  });
}
