/**
 * @file
 *
 * Integration suite for GitHub heading anchors against a real Obsidian:
 * - the `Convert links in current file` command writes a markdown link's heading subpath as its GitHub anchor,
 *   and leaves a wikilink's alone,
 * - Obsidian's own `generateMarkdownLink` writes the anchor too,
 * - following an anchor link lands on its heading, including a repeated heading's `-1` anchor,
 * - an embed of an anchor renders that heading's section,
 * - the copy of core's heading matching in `github-heading-slug.ts` still agrees with core's `resolveSubpath`.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import type {
  CachedMetadata,
  HeadingCache,
  MarkdownView,
  SettingTab
} from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from '../settings/plugin-settings.ts';

import { LinkConversionMode } from '../settings/link-conversion-mode.ts';
import { LinkStyleMode } from '../settings/link-style-mode.ts';
import { findHeadingByObsidianSubpath } from './github-heading-slug.ts';

/**
 * What core's own `resolveSubpath` answers for each subpath, beside the headings it answered from.
 */
interface CoreResolution {
  readonly coreLines: (null | number)[];
  readonly headings: HeadingCache[];
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
const FOLDER = 'github-anchors';
const TARGET_PATH = `${FOLDER}/target.md`;

const TARGET_CONTENT = `# First Part

First body

## Shared

Shared one

# Second Part!

Second body

## Shared

Shared two
`;

describe('GitHub heading anchors (Desktop)', () => {
  beforeAll(async () => {
    await evalInObsidian({
      async callback({ app, folder, linkStyleMode, mode, pluginId, targetContent, targetPath }): Promise<void> {
        const INDEX_TIMEOUT_IN_MILLISECONDS = 5000;
        const POLL_INTERVAL_IN_MILLISECONDS = 100;
        app.vault.setConfig('useMarkdownLinks', true);
        app.vault.setConfig('newLinkFormat', 'relative');
        const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
        if (!settingTab) {
          throw new Error(`Settings tab not found for plugin: ${pluginId}`);
        }

        await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
          settings.linkConversionMode = mode;
          settings.linkStyleMode = linkStyleMode;
          settings.shouldUseAngleBrackets = true;
          settings.shouldUseLeadingDotForRelativePaths = false;
          settings.shouldUseGitHubHeadingAnchors = true;
        });

        const existingFolder = app.vault.getAbstractFileByPath(folder);
        if (existingFolder) {
          await app.fileManager.trashFile(existingFolder);
        }

        await app.vault.createFolder(folder);
        const targetFile = await app.vault.create(targetPath, targetContent);
        const start = performance.now();
        while (performance.now() - start < INDEX_TIMEOUT_IN_MILLISECONDS) {
          if ((app.metadataCache.getFileCache(targetFile)?.headings?.length ?? 0) === 4) {
            return;
          }

          await sleep(POLL_INTERVAL_IN_MILLISECONDS);
        }

        throw new Error('The target note was never indexed');
      },
      input: {
        folder: FOLDER,
        linkStyleMode: LinkStyleMode.PreserveExisting,
        mode: LinkConversionMode.OnExplicitCommand,
        pluginId: PLUGIN_ID,
        targetContent: TARGET_CONTENT,
        targetPath: TARGET_PATH
      },
      vaultPath: getTemporaryVault().path
    });
  });

  // The suites share one vault and one plugin instance, so every setting changed above goes back to its default.
  afterAll(async () => {
    await evalInObsidian({
      async callback({ app, linkConversionMode, linkStyleMode, pluginId }): Promise<void> {
        const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
        await (settingTab as TestableSettingsTab | undefined)?.pluginSettingsComponent.editAndSave((settings) => {
          settings.linkConversionMode = linkConversionMode;
          settings.linkStyleMode = linkStyleMode;
          settings.shouldUseAngleBrackets = true;
          settings.shouldUseLeadingDotForRelativePaths = true;
          settings.shouldUseGitHubHeadingAnchors = false;
        });
      },
      input: {
        linkConversionMode: LinkConversionMode.OnSaveCommand,
        linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
        pluginId: PLUGIN_ID
      },
      vaultPath: getTemporaryVault().path
    });
  });

  it('should write anchors through the convert links command, leaving wikilinks alone', async () => {
    const content = await evalInObsidian({
      async callback({ app, folder, pluginId, sourceContent }): Promise<string> {
        const SETTLE_TIMEOUT_IN_MILLISECONDS = 5000;
        const POLL_INTERVAL_IN_MILLISECONDS = 100;
        const sourceFile = await app.vault.create(`${folder}/convert.md`, sourceContent);
        await app.workspace.getLeaf(false).openFile(sourceFile);
        app.commands.executeCommandById(`${pluginId}:convert-links-in-current-file`);

        const start = performance.now();
        let fileContent = sourceContent;
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS && !fileContent.includes('#shared-1')) {
          await sleep(POLL_INTERVAL_IN_MILLISECONDS);
          fileContent = await app.vault.read(sourceFile);
        }

        return fileContent;
      },
      input: {
        folder: FOLDER,
        pluginId: PLUGIN_ID,
        sourceContent: '[a](<target.md#Second Part!>)\n\n[[target#First Part]]\n\n[c](<target.md#Missing>)\n\n[b](<target.md#Second Part!#Shared>)\n'
      },
      vaultPath: getTemporaryVault().path
    });

    expect(content).toBe('[a](<target.md#second-part>)\n\n[[target#First Part]]\n\n[c](<target.md#Missing>)\n\n[b](<target.md#shared-1>)\n');
  });
  it('should write an anchor when Obsidian generates a markdown link to a heading', async () => {
    const link = await evalInObsidian({
      callback({ app, targetPath }): string {
        const targetFile = app.vault.getFileByPath(targetPath);
        if (!targetFile) {
          throw new Error('The target note is missing');
        }

        return app.fileManager.generateMarkdownLink(targetFile, 'github-anchors/source.md', '#Second Part!', 'x');
      },
      input: { targetPath: TARGET_PATH },
      vaultPath: getTemporaryVault().path
    });

    expect(link).toBe('[x](<target.md#second-part>)');
  });

  it('should land on the heading an anchor names when the link is followed', async () => {
    const lines = await evalInObsidian({
      async callback({ app, folder, obsidianModule }): Promise<number[]> {
        const WAIT_ATTEMPTS = 50;
        const WAIT_INTERVAL_IN_MILLISECONDS = 50;
        const result: number[] = [];
        for (const linktext of ['target.md#second-part', 'target.md#shared-1', 'target.md#Second Part!']) {
          await app.workspace.openLinkText(linktext, `${folder}/convert.md`, false);
          result.push(await waitForCursorLine());
        }

        return result;

        async function waitForCursorLine(): Promise<number> {
          let line = -1;
          for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt++) {
            const view: MarkdownView | null = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
            if (view?.file?.basename === 'target') {
              line = view.editor.getCursor().line;
              if (line > 0) {
                return line;
              }
            }

            await sleep(WAIT_INTERVAL_IN_MILLISECONDS);
          }

          return line;
        }
      },
      input: { folder: FOLDER },
      vaultPath: getTemporaryVault().path
    });

    // `# Second Part!` sits on line 8 and the second `## Shared` on line 12.
    expect(lines).toEqual([8, 12, 8]);
  });

  it('should render the section an embedded anchor names', async () => {
    const text = await evalInObsidian({
      async callback({ app, folder, obsidianModule }): Promise<string> {
        const RENDER_TIMEOUT_IN_MILLISECONDS = 5000;
        const POLL_INTERVAL_IN_MILLISECONDS = 100;
        const containerEl = createDiv();
        activeDocument.body.append(containerEl);
        const component = new obsidianModule.Component();
        component.load();
        try {
          await obsidianModule.MarkdownRenderer.render(app, '![](target.md#shared-1)', containerEl, `${folder}/convert.md`, component);
          const start = performance.now();
          while (performance.now() - start < RENDER_TIMEOUT_IN_MILLISECONDS) {
            const embedText = containerEl.querySelector('.markdown-embed')?.textContent ?? '';
            if (embedText.includes('Shared')) {
              return embedText;
            }

            await sleep(POLL_INTERVAL_IN_MILLISECONDS);
          }

          return containerEl.textContent;
        } finally {
          component.unload();
          containerEl.remove();
        }
      },
      input: { folder: FOLDER },
      vaultPath: getTemporaryVault().path
    });

    expect(text).toContain('Shared two');
    expect(text).not.toContain('Shared one');
    expect(text).not.toContain('Second body');
  });

  it('should match headings exactly as core\'s resolveSubpath does', async () => {
    const SUBPATHS = ['#first part', '#Second Part', '#second part!', '#Shared', '#Second Part!#Shared', '#First Part#Shared', '#Shared#Shared', '#missing'];
    const { coreLines, headings } = await evalInObsidian({
      callback({ app, obsidianModule, subpaths, targetPath }): CoreResolution {
        const targetFile = app.vault.getFileByPath(targetPath);
        const cache: CachedMetadata | null = targetFile ? app.metadataCache.getFileCache(targetFile) : null;
        if (!cache?.headings) {
          throw new Error('The target note has no headings');
        }

        return {
          coreLines: subpaths.map((subpath) => {
            const result = obsidianModule.resolveSubpath(cache, subpath);
            return result?.type === 'heading' ? result.current.position.start.line : null;
          }),
          headings: cache.headings
        };
      },
      input: { subpaths: SUBPATHS, targetPath: TARGET_PATH },
      vaultPath: getTemporaryVault().path
    });

    expect(SUBPATHS.map((subpath) => findHeadingByObsidianSubpath(headings, subpath)?.heading.position.start.line ?? null)).toEqual(coreLines);
  });
});
