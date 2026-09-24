/**
 * @file
 *
 * Integration suite for the two conversions, driving a real Obsidian instance:
 * - demoting embeds to links, with and without the `shouldAppendFileNameWhenDemotingEmbeds` sub-bullet,
 * - confining a demotion or a conversion to the editor selection, including against an unsaved buffer —
 *   the one place a wrong offset would corrupt a note rather than merely fail — and across the
 *   conversion's passes, one of which can change the length of a link inside the selection,
 * - resolving an alias-only wikilink through another note's `aliases` frontmatter,
 * - declining to resolve one when two notes answer to the name, and not creating a note for it either,
 * - both of those again with the real Advanced Metadata Cache installed, proving the lookup reads that
 *   plugin's name index rather than walking the vault — and removing it again, so every other case here
 *   keeps proving the walk,
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

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import {
  bootstrapDemoVaultPlugins,
  DEFAULT_CONFIG_DIRECTORY,
  evalInObsidian
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from './plugin-settings.ts';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { LinkPathStyleMode } from './link-path-style-mode.ts';
import { LinkStyleMode } from './link-style-mode.ts';

/**
 * `app.metadataCache.getLinkSuggestions` as Advanced Metadata Cache's `Names` module leaves it: the
 * function object the plugin under test duck-types, carrying the reverse lookup it reads.
 */
interface GraftedGetLinkSuggestions {
  getPathsByNameSafe?: (name: string) => Promise<string[]>;
  safe?: () => Promise<unknown>;
}

/**
 * Advanced Metadata Cache's settings, seen through the one the suite switches.
 */
interface NamesModuleSettings {
  isNamesModuleEnabled: boolean;
}

/**
 * Advanced Metadata Cache's settings component, seen through the one method the suite needs.
 */
interface NamesModuleSettingsComponent {
  editAndSave: (editor: (settings: NamesModuleSettings) => void) => Promise<void>;
}

/**
 * Advanced Metadata Cache, seen through the one member the suite needs to switch its `Names` module on.
 */
interface NamesModuleSwitchablePlugin {
  readonly pluginSettingsComponent: NamesModuleSettingsComponent;
}

declare global {
  interface Window {
    /**
     * The names the recording wrapper saw Advanced Metadata Cache's index asked for, kept on the renderer's
     * global so a later `evalInObsidian` call can read them back.
     */
    betterMarkdownLinksNameLookups?: string[];
  }
}

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
const CONVERT_TO_MARKDOWN_SELECTION_COMMAND_ID = `${PLUGIN_ID}:convert-links-to-markdown-in-current-selection`;
const SAVE_COMMAND_ID = 'editor:save-file';

const ADVANCED_METADATA_CACHE_PLUGIN_ID = 'advanced-metadata-cache';
const ADVANCED_METADATA_CACHE_REPO = 'mnaoumov/obsidian-advanced-metadata-cache';
// Pinned, so an Advanced Metadata Cache release cannot turn this suite red unannounced: moving it is a
// deliberate edit here, made when this plugin wants to prove itself against the newer index.
const ADVANCED_METADATA_CACHE_VERSION = '1.0.0';
// Somewhere gitignored, keyed by the version, so a warm checkout downloads nothing and a version bump
// cannot be satisfied by the previous version's files.
const ADVANCED_METADATA_CACHE_DOWNLOAD_ROOT = join(
  process.cwd(),
  'dist',
  'integration-test-plugins',
  `${ADVANCED_METADATA_CACHE_PLUGIN_ID}-${ADVANCED_METADATA_CACHE_VERSION}`
);
const ADVANCED_METADATA_CACHE_ASSET_NAMES = ['main.js', 'manifest.json'] as const;
// Downloading the release and building the name index both take longer than a single test's default.
const ADVANCED_METADATA_CACHE_SETUP_TIMEOUT_IN_MILLISECONDS = 120_000;
const NAMES_MODULE_GRAFT_TIMEOUT_IN_MILLISECONDS = 20_000;

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

// The same two targets as wikilinks, for the convert commands' selection scenarios.
const FIRST_WIKILINK = '[[Embed target]]';
const SECOND_WIKILINK = '[[Other target]]';
const TWO_WIKILINK_CONTENT = `${FIRST_WIKILINK}\n\nsome prose in between\n\n${SECOND_WIKILINK}`;

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

  // Selection is a fourth scope beside file, folder and vault, and every command has it.
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

  describe('converting links in a selection', () => {
    it('should force markdown on the selected wikilink only, measured against the unsaved buffer', async () => {
      const result = await runScenario({
        commandId: CONVERT_TO_MARKDOWN_SELECTION_COMMAND_ID,
        companions: TWO_EMBED_COMPANIONS,
        content: TWO_WIKILINK_CONTENT,
        dirtyPrefix: '# A heading typed and not saved\n\n',
        selectionMarker: FIRST_WIKILINK,
        settings: {},
        settledAbsentMarker: FIRST_WIKILINK,
        sourceKey: 'markdown-selection-dirty'
      });

      expect(result.content).toContain('# A heading typed and not saved');
      expect(result.content).toContain(`](<${EMBED_TARGET_PATH}>)`);
      expect(result.content).toContain(SECOND_WIKILINK);
    });

    it('should force relative paths on the selected wikilink only', async () => {
      const nestedLink = `[[${NESTED_TARGET_BASENAME}]]`;
      const result = await runScenario({
        commandId: `${PLUGIN_ID}:convert-link-paths-to-relative-in-current-selection`,
        companions: { [NESTED_TARGET_PATH]: 'body\n' },
        content: `${nestedLink}\n\nsome prose in between\n\n${nestedLink}`,
        // `indexOf` finds the FIRST of the two identical links.
        selectionMarker: nestedLink,
        settings: {},
        settledMarker: './',
        sourceKey: 'path-style-selection'
      });

      expect(result.content).toBe(`[[./Sub/Deep target]]\n\nsome prose in between\n\n${nestedLink}`);
    });

    // The conversion is up to three passes over the note, and the range handed to the first describes the
    // note before any of them. Here the alias pass LENGTHENS the first link, which pushes the second
    // selected link past the original end offset: a range reused verbatim would leave it a wikilink, and
    // one carried too far would convert the unselected third.
    it('should carry the selection across a pass that changed the length of a link inside it', async () => {
      const selected = `[[The Simple One]] ${FIRST_WIKILINK}`;
      const result = await runScenario({
        commandId: CONVERT_TO_MARKDOWN_SELECTION_COMMAND_ID,
        companions: {
          ...TWO_EMBED_COMPANIONS,
          [ALIASED_NOTE_PATH]: ALIASED_NOTE_CONTENT
        },
        content: `${selected}\n\nsome prose in between\n\n${SECOND_WIKILINK}`,
        selectionMarker: selected,
        settings: { shouldResolveLinksViaAliases: true },
        settledMarker: `](<${EMBED_TARGET_PATH}>)`,
        sourceKey: 'markdown-selection-carry'
      });

      expect(result.content).toContain(`(<${ALIASED_NOTE_PATH}>)`);
      expect(result.content).toContain(`](<${EMBED_TARGET_PATH}>)`);
      expect(result.content).toContain(SECOND_WIKILINK);
      expect(result.createdNotePaths).toHaveLength(0);
    });

    it('should create no note for a wikilink outside the selection', async () => {
      const result = await runScenario({
        commandId: `${PLUGIN_ID}:convert-links-in-current-selection`,
        companions: TWO_EMBED_COMPANIONS,
        content: `${FIRST_WIKILINK}\n\nsome prose in between\n\n[[A note outside the selection]]`,
        selectionMarker: FIRST_WIKILINK,
        settings: { shouldCreateMissingNotes: true },
        sourceKey: 'create-selection'
      });

      expect(result.createdNotePaths).toHaveLength(0);
      expect(result.content).toContain('[[A note outside the selection]]');
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

    // The fast path, against the real plugin rather than a stub of its graft: the unit suite already
    // covers both branches of the lookup, and what it cannot prove is that the graft the real plugin
    // installs is the one this plugin duck-types. Nested so its setup and teardown bracket only these
    // cases — every case outside it must keep running on the vault walk, with the plugin ABSENT.
    describe('with Advanced Metadata Cache installed', () => {
      beforeAll(async () => {
        await installAdvancedMetadataCache();
      }, ADVANCED_METADATA_CACHE_SETUP_TIMEOUT_IN_MILLISECONDS);

      afterAll(async () => {
        await uninstallAdvancedMetadataCache();
        // Asserted rather than assumed: a graft left behind would quietly move every later alias case
        // onto the index, and the walk would go unproven with the suite still green.
        expect(await hasNameIndexGraft()).toBe(false);
      }, ADVANCED_METADATA_CACHE_SETUP_TIMEOUT_IN_MILLISECONDS);

      it('should resolve an alias-only wikilink through the name index', async () => {
        // The ambiguous walk case above leaves its rival behind, and the index — unlike the walk case it
        // mirrors, which runs first — would rightly see two notes and decline.
        await trashNotes([RIVAL_ALIASED_NOTE_PATH]);
        await resetNameLookups();

        const result = await runScenario({
          commandId: CONVERT_COMMAND_ID,
          companions: { [ALIASED_NOTE_PATH]: ALIASED_NOTE_CONTENT },
          content: '[[The Simple One]]',
          settings: { shouldResolveLinksViaAliases: true },
          settledMarker: 'Aliased target',
          sourceKey: 'resolve-alias-index'
        });

        expect(result.content).toContain('Aliased target');
        expect(result.createdNotePaths).toHaveLength(0);
        expect(await readNameLookups()).toContain('The Simple One');
      });

      it('should leave the wikilink alone when the index names two notes', async () => {
        await resetNameLookups();

        const result = await runScenario({
          commandId: CONVERT_COMMAND_ID,
          companions: {
            [ALIASED_NOTE_PATH]: ALIASED_NOTE_CONTENT,
            [RIVAL_ALIASED_NOTE_PATH]: ALIASED_NOTE_CONTENT
          },
          content: '[[The Simple One]]',
          settings: { shouldCreateMissingNotes: true, shouldResolveLinksViaAliases: true },
          sourceKey: 'resolve-ambiguous-index'
        });

        expect(result.content).toBe('[[The Simple One]]');
        expect(result.createdNotePaths).toHaveLength(0);
        expect(await readNameLookups()).toContain('The Simple One');
      });
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
 * Checks whether `getLinkSuggestions` carries Advanced Metadata Cache's reverse lookup, which is what
 * moves the plugin under test off the vault walk.
 *
 * @returns Whether the graft is there.
 */
async function hasNameIndexGraft(): Promise<boolean> {
  return await evalInObsidian({
    callback({ app }): boolean {
      return (app.metadataCache.getLinkSuggestions as GraftedGetLinkSuggestions).getPathsByNameSafe !== undefined;
    },
    vaultPath: getTemporaryVault().path
  });
}

/**
 * Downloads the pinned Advanced Metadata Cache release (once per machine), installs it into the test
 * vault, enables it, switches its `Names` module on, waits for the index to be built, and wraps its
 * `getPathsByNameSafe` so the suite can tell afterwards which names the index was asked for.
 *
 * The files are written through Obsidian's own adapter into `app.vault.configDir`, so the install lands
 * wherever this vault actually reads plugins from.
 */
async function installAdvancedMetadataCache(): Promise<void> {
  await bootstrapDemoVaultPlugins({
    demoVaultPath: ADVANCED_METADATA_CACHE_DOWNLOAD_ROOT,
    injectPlugins: [{
      pluginId: ADVANCED_METADATA_CACHE_PLUGIN_ID,
      repo: ADVANCED_METADATA_CACHE_REPO,
      version: ADVANCED_METADATA_CACHE_VERSION
    }]
  });

  const assets: Record<string, string> = {};
  for (const assetName of ADVANCED_METADATA_CACHE_ASSET_NAMES) {
    assets[assetName] = await readFile(
      // The bootstrap installs into the default config folder of the "demo vault" it is pointed at, which here is only a download cache.
      join(ADVANCED_METADATA_CACHE_DOWNLOAD_ROOT, DEFAULT_CONFIG_DIRECTORY, 'plugins', ADVANCED_METADATA_CACHE_PLUGIN_ID, assetName),
      'utf-8'
    );
  }

  await evalInObsidian({
    async callback({ app, assets: assetContents, graftTimeoutInMilliseconds, lib: { waitUntil }, pluginId }): Promise<void> {
      const pluginFolder = `${app.vault.configDir}/plugins/${pluginId}`;
      if (!await app.vault.adapter.exists(pluginFolder)) {
        await app.vault.adapter.mkdir(pluginFolder);
      }

      for (const [assetName, assetContent] of Object.entries(assetContents)) {
        await app.vault.adapter.write(`${pluginFolder}/${assetName}`, assetContent);
      }

      await app.plugins.loadManifests();
      await app.plugins.enablePlugin(pluginId);

      const plugin = app.plugins.getPlugin(pluginId) as NamesModuleSwitchablePlugin | null;
      if (!plugin) {
        throw new Error(`${pluginId} did not load`);
      }

      await plugin.pluginSettingsComponent.editAndSave((settings) => {
        settings.isNamesModuleEnabled = true;
      });

      // The module does not start inside the settings save, so the graft is waited for rather than read.
      await waitUntil({
        message: `${pluginId}'s Names module to graft getPathsByNameSafe`,
        predicate: () => (app.metadataCache.getLinkSuggestions as GraftedGetLinkSuggestions).getPathsByNameSafe !== undefined,
        timeoutInMilliseconds: graftTimeoutInMilliseconds
      });

      const getLinkSuggestions = app.metadataCache.getLinkSuggestions as GraftedGetLinkSuggestions;
      const { getPathsByNameSafe, safe } = getLinkSuggestions;
      if (!getPathsByNameSafe || !safe) {
        throw new Error(`${pluginId} is enabled, but its Names module grafted no getPathsByNameSafe`);
      }

      await safe();

      // The plugin under test reads the member off the function object at every call, so replacing it
      // here is seen by the very next lookup.
      window.betterMarkdownLinksNameLookups = [];
      getLinkSuggestions.getPathsByNameSafe = async (name: string): Promise<string[]> => {
        window.betterMarkdownLinksNameLookups?.push(name);
        return await getPathsByNameSafe(name);
      };
    },
    input: {
      assets,
      graftTimeoutInMilliseconds: NAMES_MODULE_GRAFT_TIMEOUT_IN_MILLISECONDS,
      pluginId: ADVANCED_METADATA_CACHE_PLUGIN_ID
    },
    vaultPath: getTemporaryVault().path
  });
}

/**
 * Reads the names the index has been asked for since the last {@link resetNameLookups}.
 *
 * @returns The names, in the order they were asked.
 */
async function readNameLookups(): Promise<string[]> {
  return await evalInObsidian({
    callback(): string[] {
      return [...window.betterMarkdownLinksNameLookups ?? []];
    },
    vaultPath: getTemporaryVault().path
  });
}

/**
 * Forgets every name recorded so far, so a case sees only its own lookups.
 */
async function resetNameLookups(): Promise<void> {
  await evalInObsidian({
    callback(): void {
      window.betterMarkdownLinksNameLookups = [];
    },
    vaultPath: getTemporaryVault().path
  });
}

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

/**
 * Trashes whichever of the given notes exist, so a scenario starts without them.
 *
 * @param paths - The notes to remove.
 */
async function trashNotes(paths: readonly string[]): Promise<void> {
  await evalInObsidian({
    async callback({ app, notePaths }): Promise<void> {
      for (const notePath of notePaths) {
        const file = app.vault.getAbstractFileByPath(notePath);
        if (file) {
          await app.fileManager.trashFile(file);
        }
      }
    },
    input: { notePaths: paths },
    vaultPath: getTemporaryVault().path
  });
}

/**
 * Disables Advanced Metadata Cache and removes it from the test vault again.
 */
async function uninstallAdvancedMetadataCache(): Promise<void> {
  await evalInObsidian({
    async callback({ app, pluginId }): Promise<void> {
      await app.plugins.disablePlugin(pluginId);

      const pluginFolder = `${app.vault.configDir}/plugins/${pluginId}`;
      if (await app.vault.adapter.exists(pluginFolder)) {
        await app.vault.adapter.rmdir(pluginFolder, true);
      }

      await app.plugins.loadManifests();
      delete window.betterMarkdownLinksNameLookups;
    },
    input: { pluginId: ADVANCED_METADATA_CACHE_PLUGIN_ID },
    vaultPath: getTemporaryVault().path
  });
}
