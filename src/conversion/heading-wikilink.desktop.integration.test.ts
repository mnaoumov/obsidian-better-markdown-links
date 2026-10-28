/**
 * @file
 *
 * Integration suite for issue #44: converting a note must leave a link INSIDE a heading as written. Such a
 * link is part of the heading's text, so rewriting it changes the heading and breaks every `#heading` link
 * to it, in this note and in others. It drives a real Obsidian instance with the reporter's settings
 * (Markdown links, relative link format), saves the note with the `Save current file` command, and asserts
 * on what Obsidian itself makes of the result:
 * - the heading keeps its wikilink byte-for-byte, while a body wikilink to the same note is still converted,
 * - the note's own link to the heading and an inbound link from another note both still resolve to it.
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
 * What the scenario observed after the save settled.
 */
interface ScenarioResult {
  readonly content: string;
  readonly inboundResolvedHeading: null | string;
  readonly localResolvedHeading: null | string;
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
const SOURCE_PATH = 'heading-wikilink.md';
const INBOUND_PATH = 'heading-wikilink-inbound.md';
const TARGET_PATH = 'heading-wikilink-target.md';

const HEADING_LINE = '## [[heading-wikilink-target]] wikilink heading';

// The reporter's note: a wikilink inside a heading, a link to that heading, and a body wikilink to the same note.
const UNCONVERTED_CONTENT = `${HEADING_LINE}

[to heading](#heading-wikilink-target%20wikilink%20heading)

[[heading-wikilink-target]]
`;

// The body wikilink, converted. Waiting for it proves the conversion ran.
const CONVERTED_BODY_LINK = '[heading-wikilink-target](<./heading-wikilink-target.md>)';

describe('wikilinks inside headings (Desktop)', () => {
  it('should leave a heading link as written so links to the heading keep resolving', async () => {
    const result = await runScenario();

    expect(result.content).toBe(`${HEADING_LINE}

[to heading](<#heading-wikilink-target wikilink heading>)

${CONVERTED_BODY_LINK}
`);
    expect(result.localResolvedHeading).toBe('[[heading-wikilink-target]] wikilink heading');
    expect(result.inboundResolvedHeading).toBe('[[heading-wikilink-target]] wikilink heading');
  });
});

/**
 * Applies the reporter's settings, creates the target and an inbound note, opens a fresh source file with the
 * unconverted links typed in its editor, runs the save command, waits for the conversion and the metadata
 * cache to settle, and returns the on-disk content with the heading each link to it resolves to.
 *
 * @returns What the scenario observed.
 */
async function runScenario(): Promise<ScenarioResult> {
  return evalInObsidian({
    async callback({ app, convertedBodyLink, inboundPath, mode, obsidianModule, pluginId, sourcePath, targetPath, unconvertedContent }): Promise<ScenarioResult> {
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

      for (const path of [sourcePath, inboundPath, targetPath]) {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }
      }

      await app.vault.create(targetPath, 'Target\n');
      // The inbound note is never converted: it is the link from elsewhere that a rewritten heading would strand.
      // A subpath matches a heading by its text with the link markup stripped, which is how the reporter wrote it.
      const inboundFile = await app.vault.create(inboundPath, `[[${sourcePath.replace(/\.md$/, '')}#heading-wikilink-target wikilink heading]]\n`);
      const sourceFile = await app.vault.create(sourcePath, '');

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(sourceFile);

      const view = await waitForMarkdownView();
      // Typing the unconverted links into the empty file dirties the editor so the save actually writes.
      view.editor.setValue(unconvertedContent);

      app.commands.executeCommandById('editor:save-file');

      const content = await waitForConvertedContent(sourceFile);
      const sourceCache = await waitForCacheOf(content, sourceFile);
      const localLink = sourceCache?.links?.find((linkCache) => linkCache.link.startsWith('#'));

      const inboundLink = app.metadataCache.getFileCache(inboundFile)?.links?.[0];
      const inboundTarget = inboundLink ? app.metadataCache.getFirstLinkpathDest(obsidianModule.parseLinktext(inboundLink.link).path, inboundPath) : null;

      return {
        content,
        inboundResolvedHeading: inboundLink && inboundTarget === sourceFile
          ? resolveHeading(sourceCache, inboundLink.link)
          : null,
        localResolvedHeading: localLink ? resolveHeading(sourceCache, localLink.link) : null
      };

      function resolveHeading(cache: null | ReturnType<typeof app.metadataCache.getFileCache>, link: string): null | string {
        if (!cache) {
          return null;
        }

        const resolved = obsidianModule.resolveSubpath(cache, obsidianModule.parseLinktext(link).subpath);
        return resolved?.type === 'heading' ? resolved.current.heading : null;
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

      // Returns as soon as the body link is converted; otherwise returns the on-disk content after the timeout.
      async function waitForConvertedContent(file: TFile): Promise<string> {
        const start = performance.now();
        let fileContent = await app.vault.read(file);
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          fileContent = await app.vault.read(file);
          if (fileContent.includes(convertedBodyLink)) {
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
      convertedBodyLink: CONVERTED_BODY_LINK,
      inboundPath: INBOUND_PATH,
      mode: LinkConversionMode.OnSaveCommand,
      pluginId: PLUGIN_ID,
      sourcePath: SOURCE_PATH,
      targetPath: TARGET_PATH,
      unconvertedContent: UNCONVERTED_CONTENT
    },
    vaultPath: getTemporaryVault().path
  });
}
