/**
 * @file
 *
 * Integration suite that verifies the `shouldNormalizeFileLinks` setting genuinely controls whether
 * `file://` links are normalized (decoding `%5C` and converting backslashes to forward slashes) when a
 * conversion is triggered, driving a real Obsidian instance:
 * - enabled: a body `file://` link with an encoded backslash is rewritten to forward slashes on the
 *   `Save current file` command, even though the note has no internal links to convert,
 * - enabled: `file://` links inside a multi-link frontmatter value are likewise normalized,
 * - disabled: the same `file://` link is left untouched,
 * - enabled, on every modification: a `file:` word in a code fence's info string is left alone, and a
 *   bare `file://` URL in prose stays bare, gaining only forward slashes; neither becomes an empty link,
 * - enabled, on every modification: a note whose ONLY link work is one `file:` link with backslashes, markdown
 *   or bare, is normalized when an outside program creates and then modifies it.
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

import {
  readFileSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
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

// `file://` links whose paths use encoded backslashes (`%5C`); normalizing decodes them and converts
// the backslashes to forward slashes, yielding an observably different string.
const BODY_CONTENT = '[body](file:///F:%5Cover%5Cage.txt)';
const FRONTMATTER_MULTI_LINK_CONTENT = '---\nkey: "file:///F:%5Cover%5Care.txt file:///F:%5Cover%5Cage.txt"\n---\n\nbody\n';
const ENCODED_BACKSLASH_MARKER = '%5C';

// A `file:` word in a code fence's info string is not a link, and a bare `file://` URL in prose is not a
// markdown link: normalizing must leave the first alone and keep the second bare, never wrapping either
// as `[](<...>)`.
const BARE_FILE_URL_WITH_BACKSLASH = String.raw`file:///C:\x`;
const BARE_FILE_URL_NORMALIZED = 'file:///C:/x';
const MARKDOWN_FILE_URL_WITH_BACKSLASH = String.raw`[x](<file:///C:\x>)`;
const MARKDOWN_FILE_URL_NORMALIZED = '[x](<file:///C:/x>)';
const CODE_FENCE_AND_PROSE_PREFIX = '```python fold file:python3.py\nprint(1)\n```\n\nSee ';
const PROSE_SUFFIX = ' for details.\n';
const CODE_FENCE_AND_BARE_FILE_URL_CONTENT = `${CODE_FENCE_AND_PROSE_PREFIX}${BARE_FILE_URL_WITH_BACKSLASH}${PROSE_SUFFIX}`;
const CODE_FENCE_AND_BARE_FILE_URL_EXPECTED = `${CODE_FENCE_AND_PROSE_PREFIX}${BARE_FILE_URL_NORMALIZED}${PROSE_SUFFIX}`;

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

  it('should leave a code fence info string alone and keep a bare file:// URL bare on every modification', async () => {
    const content = await runScenario({
      content: CODE_FENCE_AND_BARE_FILE_URL_CONTENT,
      mode: LinkConversionMode.OnEveryModification,
      pendingMarker: BARE_FILE_URL_WITH_BACKSLASH,
      shouldNormalizeFileLinks: true,
      sourceKey: 'code-fence-and-bare-url'
    });

    expect(content).toBe(CODE_FENCE_AND_BARE_FILE_URL_EXPECTED);
  });

  it.each([
    ['markdown', MARKDOWN_FILE_URL_WITH_BACKSLASH, MARKDOWN_FILE_URL_NORMALIZED],
    ['bare', BARE_FILE_URL_WITH_BACKSLASH, BARE_FILE_URL_NORMALIZED]
  ])('should normalize a %s file:// link in a note with no other link work when the note is modified from outside', async (kind, link, normalizedLink) => {
    const content = await runOutsideModificationScenario({
      content: `${CODE_FENCE_AND_PROSE_PREFIX}${link}${PROSE_SUFFIX}`,
      pendingMarker: link,
      sourceKey: `outside-${kind}`
    });

    // The outside modification appends a newline, which the conversion keeps.
    expect(content).toBe(`${CODE_FENCE_AND_PROSE_PREFIX}${normalizedLink}${PROSE_SUFFIX}\n`);
  });
});

/**
 * Parameters for {@link runOutsideModificationScenario}.
 */
interface RunOutsideModificationScenarioParams {
  readonly content: string;

  /**
   * A string present in the content until normalization has happened.
   */
  readonly pendingMarker: string;
  readonly sourceKey: string;
}

/**
 * Parameters for {@link runScenario}.
 */
interface RunScenarioParams {
  readonly content: string;

  /**
   * The conversion mode. `OnSaveCommand` (the default) types the content into the editor and runs the save
   * command; `OnEveryModification` writes it through `vault.modify` instead.
   */
  readonly mode?: LinkConversionMode;

  /**
   * A string present in the content until normalization has happened. Defaults to the encoded backslash.
   */
  readonly pendingMarker?: string;
  readonly shouldNormalizeFileLinks: boolean;
  readonly sourceKey: string;
}

/**
 * Turns normalization on in the `OnEveryModification` mode, then creates a note from OUTSIDE Obsidian and
 * modifies it from outside too, the way an editor or a script would, and returns its on-disk content once
 * the normalization has settled.
 *
 * The note holds nothing but `file:` links, so the only thing that can start the conversion is the
 * file-link check of the automatic trigger: with no internal link to convert, a check that missed the
 * links would leave the note as written.
 *
 * @param params - See {@link RunOutsideModificationScenarioParams}.
 * @returns The on-disk content of the note after the normalization settles.
 */
async function runOutsideModificationScenario(params: RunOutsideModificationScenarioParams): Promise<string> {
  const vaultPath = getTemporaryVault().path;
  const sourcePath = `normalize-file-links-${params.sourceKey}.md`;
  const fullPath = join(vaultPath, sourcePath);

  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, mode, pluginId, sourcePath: path }): Promise<void> {
      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkConversionMode = mode;
        settings.shouldNormalizeFileLinks = true;
        settings.shouldUseAngleBrackets = true;
      });

      const existing = app.vault.getAbstractFileByPath(path);
      if (!existing) {
        return;
      }

      await app.fileManager.trashFile(existing);
      await waitUntil({
        message: 'the previous note to leave the vault',
        predicate: () => !app.vault.getAbstractFileByPath(path)
      });
    },
    input: { mode: LinkConversionMode.OnEveryModification, pluginId: PLUGIN_ID, sourcePath },
    vaultPath
  });

  writeFileSync(fullPath, params.content);

  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, sourcePath: path }): Promise<void> {
      // The outside creation raises `create`, not `modify`, so it must have landed before the modification
      // is written, or the two would merge into one `create` and nothing would be under test.
      const CREATE_SETTLE_IN_MILLISECONDS = 1000;
      await waitUntil({
        message: 'Obsidian to see the note created from outside',
        predicate: () => Boolean(app.vault.getFileByPath(path))
      });
      await sleep(CREATE_SETTLE_IN_MILLISECONDS);
    },
    input: { sourcePath },
    vaultPath
  });

  writeFileSync(fullPath, `${params.content}\n`);

  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, pendingMarker, sourcePath: path }): Promise<void> {
      await waitUntil({
        message: 'the file: links to be normalized',
        predicate: async () => {
          const content = await app.vault.adapter.read(path);
          return !content.includes(pendingMarker);
        }
      });
    },
    input: { pendingMarker: params.pendingMarker, sourcePath },
    vaultPath
  });

  return readFileSync(fullPath, 'utf-8');
}

/**
 * Applies the given `shouldNormalizeFileLinks` setting and conversion mode, writes the given
 * un-normalized `file://` content into a fresh source file (typed in its editor and saved by the save
 * command, or written through `vault.modify` in the `OnEveryModification` mode), waits for any
 * normalization to settle, and returns the resulting on-disk content.
 *
 * @param params - See {@link RunScenarioParams}.
 * @returns The on-disk content of the source file after the save settles.
 */
async function runScenario(params: RunScenarioParams): Promise<string> {
  return evalInObsidian({
    async callback({ app, content, mode, obsidianModule, pendingMarker, pluginId, shouldNormalizeFileLinks, sourcePath, writesThroughVault }): Promise<string> {
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

      if (writesThroughVault) {
        await app.vault.modify(sourceFile, content);
        return waitForSettledContent(sourceFile);
      }

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

      // Returns as soon as the links are normalized (no pending marker remains); otherwise waits the
      // full timeout so the write has flushed and any (absent) normalization has had time to happen, then
      // returns the on-disk content.
      async function waitForSettledContent(file: TFile): Promise<string> {
        const start = performance.now();
        let fileContent = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          fileContent = await app.vault.read(file);
          if (!fileContent.includes(pendingMarker)) {
            return fileContent;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return fileContent;
      }
    },
    input: {
      content: params.content,
      mode: params.mode ?? LinkConversionMode.OnSaveCommand,
      pendingMarker: params.pendingMarker ?? ENCODED_BACKSLASH_MARKER,
      pluginId: PLUGIN_ID,
      shouldNormalizeFileLinks: params.shouldNormalizeFileLinks,
      sourcePath: `normalize-file-links-${params.sourceKey}.md`,
      writesThroughVault: params.mode === LinkConversionMode.OnEveryModification
    },
    vaultPath: getTemporaryVault().path
  });
}
