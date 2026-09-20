/**
 * @file
 *
 * Integration suite for the two conversions, driving a real Obsidian instance:
 * - demoting embeds to links, with and without the `shouldAppendFileNameWhenDemotingEmbeds` sub-bullet,
 * - confining a demotion to the editor selection, including against an unsaved buffer — the one place a
 *   wrong offset would corrupt a note rather than merely fail,
 * - resolving an alias-only wikilink through another note's `aliases` frontmatter,
 * - declining to resolve one when two notes answer to the name, and not creating a note for it either,
 * - creating the note behind a wikilink that resolves to nothing,
 * - and the invariant that makes the last one safe: the AUTOMATIC conversion paths must never create a
 *   note, however the settings are set, because they fire on every save.
 *
 * It also covers the force-Markdown link style and the force-relative link PATH style, each both as a
 * setting and as its own command, against a vault whose own `Use [[Wikilinks]]` and `New link format`
 * settings say otherwise — the one thing no unit test can prove.
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
import { LinkPathStyleMode } from './link-path-style-mode.ts';
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

  /**
   * Text to type in front of {@link content} and deliberately NOT save, leaving the editor buffer dirty
   * and every offset in the note shifted by its length.
   *
   * This is how the selection scenarios prove the one hazard a range carries: the range is measured in
   * the editor while the rewrite happens on disk. Dev-utils saves the dirty view before it reads, so the
   * two agree — but only because it does. A prefix makes the disagreement fatal if it ever stops.
   */
  readonly dirtyPrefix?: string;

  /**
   * A substring of the editor's content to select before running the command. The scenario asserts the
   * command's scope by what it did NOT touch outside this.
   */
  readonly selectionMarker?: string;

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
  readonly linkPathStyleMode?: LinkPathStyleMode;
  readonly linkStyleMode?: LinkStyleMode;
  readonly shouldAppendFileNameWhenDemotingEmbeds?: boolean;
  readonly shouldCreateMissingNotes?: boolean;
  readonly shouldResolveLinksViaAliases?: boolean;
  readonly shouldUseLeadingDotForRelativePaths?: boolean;
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
const DEMOTE_COMMAND_ID = `${PLUGIN_ID}:demote-embeds-to-links-in-current-file`;
const DEMOTE_SELECTION_COMMAND_ID = `${PLUGIN_ID}:demote-embeds-to-links-in-current-selection`;
const CONVERT_COMMAND_ID = `${PLUGIN_ID}:convert-links-in-current-file`;
const SAVE_COMMAND_ID = 'editor:save-file';

const ALIASED_NOTE_PATH = 'Aliased target.md';
const ALIASED_NOTE_CONTENT = '---\naliases:\n  - The Simple One\n---\n\nbody\n';
// A SECOND note carrying the same alias, which is the whole of what makes the name ambiguous.
const RIVAL_ALIASED_NOTE_PATH = 'Rival aliased target.md';
const EMBED_TARGET_PATH = 'Embed target.md';
// A target one folder down from the root, where the source files live: the only shape in which the
// shortest, relative and absolute path styles all write something different.
const NESTED_TARGET_BASENAME = 'Deep target';
const NESTED_TARGET_PATH = `Sub/${NESTED_TARGET_BASENAME}.md`;
const OTHER_TARGET_PATH = 'Other target.md';

// Two embeds, far enough apart that a selection can hold one and miss the other entirely.
const FIRST_EMBED = `![First](<${EMBED_TARGET_PATH}>)`;
const SECOND_EMBED = `![Second](<${OTHER_TARGET_PATH}>)`;
const TWO_EMBED_CONTENT = `${FIRST_EMBED}\n\nsome prose in between\n\n${SECOND_EMBED}`;
const TWO_EMBED_COMPANIONS = {
  [EMBED_TARGET_PATH]: 'body\n',
  [OTHER_TARGET_PATH]: 'body\n'
};

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
      // would render as nothing at all, so the target's basename is filled in.
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

  // Selection is a fourth scope beside file, folder and vault. Only the demote command has one so far:
  // it reaches `editLinks` directly, whose params carry an offset range, while the two convert commands
  // go through `updateLinksInFile` / `updateFileUrlLinksInFile`, whose params do not.
  describe('demoting embeds in a selection', () => {
    it('should demote the selected embed and leave the one outside the selection embedded', async () => {
      const result = await runScenario({
        commandId: DEMOTE_SELECTION_COMMAND_ID,
        companions: TWO_EMBED_COMPANIONS,
        content: TWO_EMBED_CONTENT,
        // Selecting the first embed EXACTLY, to its last character. Containment is inclusive at both ends,
        // so a selection that stops precisely where a link stops must still demote it — the assertion that
        // fails first if the range ever acquires an off-by-one.
        selectionMarker: FIRST_EMBED,
        settings: {},
        settledAbsentMarker: FIRST_EMBED,
        sourceKey: 'demote-selection'
      });

      expect(result.content).toContain(`[First](<${EMBED_TARGET_PATH}>)`);
      expect(result.content).not.toContain(FIRST_EMBED);
      expect(result.content).toContain(SECOND_EMBED);
    });

    it('should demote nothing at all when the selection is empty', async () => {
      const result = await runScenario({
        commandId: DEMOTE_SELECTION_COMMAND_ID,
        companions: TWO_EMBED_COMPANIONS,
        content: TWO_EMBED_CONTENT,
        settings: {},
        sourceKey: 'demote-selection-empty'
      });

      // An empty selection greys the command out rather than meaning "the whole note".
      expect(result.content).toContain(FIRST_EMBED);
      expect(result.content).toContain(SECOND_EMBED);
    });

    it('should measure the selection against the unsaved buffer, not the stale file on disk', async () => {
      const result = await runScenario({
        commandId: DEMOTE_SELECTION_COMMAND_ID,
        companions: TWO_EMBED_COMPANIONS,
        content: TWO_EMBED_CONTENT,
        // Shifts every offset in the note while disk and metadata cache still describe it as it was.
        // If dev-utils read the file without first saving this view, the range would land on the wrong
        // bytes and either demote the wrong embed or corrupt one — which is why this is asserted here
        // rather than assumed.
        dirtyPrefix: '# A heading typed and not saved\n\n',
        selectionMarker: FIRST_EMBED,
        settings: {},
        settledAbsentMarker: FIRST_EMBED,
        sourceKey: 'demote-selection-dirty'
      });

      expect(result.content).toContain('# A heading typed and not saved');
      expect(result.content).toContain(`[First](<${EMBED_TARGET_PATH}>)`);
      expect(result.content).toContain(SECOND_EMBED);
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

    it('should leave the wikilink alone when two notes answer to the alias', async () => {
      const result = await runScenario({
        commandId: CONVERT_COMMAND_ID,
        companions: {
          [ALIASED_NOTE_PATH]: ALIASED_NOTE_CONTENT,
          [RIVAL_ALIASED_NOTE_PATH]: ALIASED_NOTE_CONTENT
        },
        content: '[[The Simple One]]',
        // Creation is ON, which is the half that would be easy to get wrong: an ambiguous name is not
        // a missing one, so it must not fall through to a third note being created for it.
        settings: { shouldCreateMissingNotes: true, shouldResolveLinksViaAliases: true },
        sourceKey: 'resolve-ambiguous'
      });

      // No settled marker, so the helper waits the full settle timeout and the assertion is made after
      // the conversion has had every chance to run. Obsidian does not resolve an alias-only wikilink
      // itself — `getFirstLinkpathDest` answers null and the link sits in `unresolvedLinks` — so
      // nothing downstream rewrites what this plugin declines to.
      expect(result.content).toBe('[[The Simple One]]');
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
      // setting on, so the link correctly stays a wikilink - pointed at the new note, not restyled. The
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
  // whose own `Use [[Wikilinks]]` setting says otherwise. The test vault leaves that setting ON, so a
  // wikilink surviving as a wikilink is the baseline these two scenarios have to beat.
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

  // The capability inherited from Consistent Attachments and Links' `Convert all link paths to relative`.
  // The test vault leaves Obsidian's own `New link format` at its default, so a link that is already in
  // its shortest form surviving untouched is the baseline these scenarios have to beat.
  describe('forcing the relative link path style', () => {
    it('should leave a shortest-form link alone when the path style follows the Obsidian setting', async () => {
      const result = await runScenario({
        commandId: CONVERT_COMMAND_ID,
        companions: { [NESTED_TARGET_PATH]: 'body\n' },
        content: `[[${NESTED_TARGET_BASENAME}]]`,
        settings: {},
        sourceKey: 'path-style-baseline'
      });

      expect(result.content).toBe(`[[${NESTED_TARGET_BASENAME}]]`);
    });

    // Also the proof that the leading dot is STATED rather than inferred: the original link carries no
    // dot, so a conversion that read the decoration off it would write `[[Sub/Deep target]]`.
    it('should force relative for one run via the convert-link-paths command', async () => {
      const result = await runScenario({
        commandId: `${PLUGIN_ID}:convert-link-paths-to-relative-in-current-file`,
        companions: { [NESTED_TARGET_PATH]: 'body\n' },
        content: `[[${NESTED_TARGET_BASENAME}]]`,
        settings: {},
        settledMarker: './',
        sourceKey: 'path-style-command'
      });

      expect(result.content).toBe('[[./Sub/Deep target]]');
    });

    it('should force relative on the plain convert command when the relative path style is selected', async () => {
      const result = await runScenario({
        commandId: CONVERT_COMMAND_ID,
        companions: { [NESTED_TARGET_PATH]: 'body\n' },
        content: `[[${NESTED_TARGET_BASENAME}]]`,
        settings: { linkPathStyleMode: LinkPathStyleMode.RelativePathToTheSource },
        settledMarker: './',
        sourceKey: 'path-style-setting'
      });

      expect(result.content).toBe('[[./Sub/Deep target]]');
    });

    // The decoration is the setting's, not a constant: turning the leading dot off has to reach a forced
    // conversion too.
    it('should honour the leading-dot setting while forcing relative', async () => {
      const result = await runScenario({
        commandId: `${PLUGIN_ID}:convert-link-paths-to-relative-in-current-file`,
        companions: { [NESTED_TARGET_PATH]: 'body\n' },
        content: `[[${NESTED_TARGET_BASENAME}]]`,
        settings: { shouldUseLeadingDotForRelativePaths: false },
        settledMarker: 'Sub/',
        sourceKey: 'path-style-no-dot'
      });

      expect(result.content).toBe('[[Sub/Deep target]]');
    });
  });

  // The reason `shouldCreateMissingNotes` is safe to offer at all: it is wired to the explicit convert
  // commands only. Were it reachable from the automatic paths, every auto-save on a note with a typo'd
  // wikilink would silently add a file to the vault.
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
    async callback({ app, commandId, companions, content, dirtyPrefix, explicitCommandMode, obsidianModule, obsidianSettingsDefaultPathStyle, obsidianSettingsDefaultStyle, pluginId, selectionMarker, settings, settledAbsentMarker, settledMarker, sourcePath }): Promise<ScenarioResult> {
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
        pluginSettings.linkPathStyleMode = settings.linkPathStyleMode ?? obsidianSettingsDefaultPathStyle;
        pluginSettings.shouldUseAngleBrackets = true;
        // Pinned rather than left at the plugin default, because the forced-relative scenarios assert the
        // dot it writes.
        pluginSettings.shouldUseLeadingDotForRelativePaths = settings.shouldUseLeadingDotForRelativePaths ?? true;
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
      // before the command runs. Without this the command sees a file with no references and no-ops,
      // which reads as "the feature is broken" only intermittently — whichever way the race lands.
      await view.save();
      await waitForIndexedReference(sourceFile);

      if (dirtyPrefix) {
        // Left UNSAVED on purpose. Disk and cache now describe the pre-prefix note while the editor —
        // and therefore the selection about to be measured — describes the shifted one.
        view.editor.setValue(dirtyPrefix + content);
      }

      if (selectionMarker) {
        const editorContent = view.editor.getValue();
        const markerStart = editorContent.indexOf(selectionMarker);
        if (markerStart === -1) {
          throw new Error(`Selection marker not found in the editor: ${selectionMarker}`);
        }

        view.editor.setSelection(
          view.editor.offsetToPos(markerStart),
          view.editor.offsetToPos(markerStart + selectionMarker.length)
        );
      }

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

        // `vault.create` will not make the folder for a nested companion, and the path-style scenarios
        // need one: a target beside the source cannot tell the three path styles apart.
        const folderPath = path.split('/').slice(0, -1).join('/');
        if (folderPath && !app.vault.getFolderByPath(folderPath)) {
          await app.vault.createFolder(folderPath);
        }

        return await app.vault.create(path, fileContent);
      }

      // Polls until Obsidian's metadata cache reports a link or embed from the content just typed. Every
      // scenario writes at least one reference, and none needs the cache to be complete before the
      // command runs — dev-utils re-reads it, after saving the view, from inside the command itself.
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
      // waits the full timeout, so the assertion is made after the conversion has had every chance to run.
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
      dirtyPrefix: params.dirtyPrefix ?? '',
      explicitCommandMode: LinkConversionMode.OnExplicitCommand,
      obsidianSettingsDefaultPathStyle: LinkPathStyleMode.ObsidianSettingsDefault,
      obsidianSettingsDefaultStyle: LinkStyleMode.ObsidianSettingsDefault,
      pluginId: PLUGIN_ID,
      selectionMarker: params.selectionMarker ?? '',
      settings: params.settings,
      settledAbsentMarker: params.settledAbsentMarker ?? '',
      settledMarker: params.settledMarker ?? '',
      sourcePath: `demote-and-resolve-${params.sourceKey}.md`
    },
    vaultPath: getTemporaryVault().path
  });
}
