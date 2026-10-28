/**
 * @file
 *
 * Integration suite for issue #43: converting a link to a heading whose text contains `<` or `>` must
 * still produce a link. Obsidian writes such a link percent-encoded; converting it into an
 * angle-bracket destination with the raw `<` and `>` kept is not a link any more, because CommonMark
 * forbids both inside `<…>`. It drives a real Obsidian instance with the reporter's settings (Markdown
 * links, relative link format, the plugin's default angle brackets), saves the note with the
 * `Save current file` command, and asserts on what Obsidian itself makes of the result:
 * - the angle brackets of the heading text are encoded in the destination,
 * - Obsidian's own parser still sees both links, and each resolves to its heading.
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
 * One link as Obsidian's metadata cache parsed it, with the heading its subpath resolves to.
 */
interface ScenarioLink {
  readonly link: string;
  readonly resolvedHeading: null | string;
}

/**
 * What the scenario observed after the save settled.
 */
interface ScenarioResult {
  readonly content: string;
  readonly links: readonly ScenarioLink[];
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
const SOURCE_PATH = 'heading-angle-brackets.md';

const ANGLE_HEADING = 'Angle <note> in a heading';
const CODE_HEADING = 'Code `<note>` in a heading';

// The links exactly as Obsidian writes them when a heading is picked from the `[[#` suggester.
const UNCONVERTED_CONTENT = `## ${ANGLE_HEADING}

## ${CODE_HEADING}

[${ANGLE_HEADING}](#Angle%20<note>%20in%20a%20heading)
[${CODE_HEADING}](#Code%20\`<note>\`%20in%20a%20heading)
`;

// Converted into angle-bracket destinations; the plugin's leftover percent-encoding of spaces is gone.
const CONVERTED_MARKER = '](<#';

// `<note>` with both angle brackets percent-encoded, which is what keeps the angle-bracket destination valid.
const ENCODED_NOTE_TAG = `${encodeURIComponent('<')}note${encodeURIComponent('>')}`;

describe('heading links with angle brackets (Desktop)', () => {
  it('should keep links to headings containing < or > working after conversion', async () => {
    const result = await runScenario();

    expect(result.content).toContain(`[${ANGLE_HEADING}](<#Angle ${ENCODED_NOTE_TAG} in a heading>)`);
    expect(result.content).toContain(`[${CODE_HEADING}](<#Code \`${ENCODED_NOTE_TAG}\` in a heading>)`);
    expect(result.links).toEqual([
      { link: `#${ANGLE_HEADING}`, resolvedHeading: ANGLE_HEADING },
      { link: `#${CODE_HEADING}`, resolvedHeading: CODE_HEADING }
    ]);
  });
});

/**
 * Applies the reporter's settings, opens a fresh source file with the unconverted links typed in its
 * editor, runs the save command, waits for the conversion and the metadata cache to settle, and
 * returns the on-disk content with the links Obsidian parsed from it.
 *
 * @returns What the scenario observed.
 */
async function runScenario(): Promise<ScenarioResult> {
  return evalInObsidian({
    async callback({ app, convertedMarker, mode, obsidianModule, pluginId, sourcePath, unconvertedContent }): Promise<ScenarioResult> {
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

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkConversionMode = mode;
        settings.shouldUseAngleBrackets = true;
      });

      const existing = app.vault.getAbstractFileByPath(sourcePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }

      const sourceFile = await app.vault.create(sourcePath, '');

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(sourceFile);

      const view = await waitForMarkdownView();
      // Typing the unconverted links into the empty file dirties the editor so the save actually writes.
      view.editor.setValue(unconvertedContent);

      app.commands.executeCommandById('editor:save-file');

      const content = await waitForConvertedContent(sourceFile);
      const cache = await waitForCacheOf(content, sourceFile);

      return {
        content,
        links: (cache?.links ?? []).map((linkCache) => {
          const subpath = obsidianModule.parseLinktext(linkCache.link).subpath;
          const resolved = cache ? obsidianModule.resolveSubpath(cache, subpath) : null;
          return {
            link: linkCache.link,
            resolvedHeading: resolved?.type === 'heading' ? resolved.current.heading : null
          };
        })
      };

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

      // Returns as soon as the links are converted; otherwise returns the on-disk content after the timeout.
      async function waitForConvertedContent(file: TFile): Promise<string> {
        const start = performance.now();
        let fileContent = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          fileContent = await app.vault.read(file);
          if (fileContent.includes(convertedMarker)) {
            return fileContent;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return fileContent;
      }

      // Returns the metadata cache once it describes `fileContent`, so its links are the parse of the converted text.
      async function waitForCacheOf(fileContent: string, file: TFile): Promise<null | ReturnType<typeof app.metadataCache.getFileCache>> {
        const start = performance.now();
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          const fileCache = app.metadataCache.getFileCache(file);
          const lastSection = fileCache?.sections?.at(-1);
          if (lastSection?.position.end.offset === fileContent.trimEnd().length) {
            return fileCache;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        return app.metadataCache.getFileCache(file);
      }
    },
    input: {
      convertedMarker: CONVERTED_MARKER,
      mode: LinkConversionMode.OnSaveCommand,
      pluginId: PLUGIN_ID,
      sourcePath: SOURCE_PATH,
      unconvertedContent: UNCONVERTED_CONTENT
    },
    vaultPath: getTemporaryVault().path
  });
}
