/**
 * @file
 *
 * Integration suite pinning what a real Obsidian does with a MARKDOWN link in a property, which is what the
 * `shouldConvertFrontmatterWikilinksToMarkdown` setting's description and default rest on.
 *
 * Since Obsidian 1.11.0 (names with spaces since 1.11.3) a property whose value is one markdown link is a
 * real link: it is indexed, it is a backlink, and Bases' `file.hasLink` sees it. What it still is NOT is a
 * Bases link VALUE — a filter comparing the property with `link(...)` matches only the wikilink — and that
 * is the one loss that keeps the setting off by default. The day that case starts matching, this suite
 * fails, which is the cue to revisit the default.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import type { TFile } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

const FOLDER_PATH = 'frontmatter-markdown-link';
const TARGET_PATH = `${FOLDER_PATH}/Target with space.md`;
const WIKILINK_SOURCE_PATH = `${FOLDER_PATH}/wikilink-source.md`;
const MARKDOWN_SOURCE_PATH = `${FOLDER_PATH}/markdown-source.md`;

const SOURCES: Record<string, string> = {
  [MARKDOWN_SOURCE_PATH]: '---\nrelated: "[Target with space](<Target with space.md>)"\n---\n\nbody\n',
  [WIKILINK_SOURCE_PATH]: '---\nrelated: "[[Target with space]]"\n---\n\nbody\n'
};

describe('markdown links in properties (Desktop)', () => {
  beforeAll(async () => {
    await evalInObsidian({
      async callback({ app, folderPath, sources, targetPath }): Promise<void> {
        const SETTLE_TIMEOUT_IN_MILLISECONDS = 10_000;
        const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;

        if (!app.vault.getFolderByPath(folderPath)) {
          await app.vault.createFolder(folderPath);
        }

        await recreate(targetPath, 'target\n');
        for (const [path, content] of Object.entries(sources)) {
          await recreate(path, content);
        }

        const start = performance.now();
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          if (Object.keys(sources).every((path) => app.metadataCache.resolvedLinks[path]?.[targetPath] !== undefined)) {
            return;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        throw new Error('The metadata cache never resolved the property links');

        async function recreate(path: string, content: string): Promise<TFile> {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }

          return await app.vault.create(path, content);
        }
      },
      input: { folderPath: FOLDER_PATH, sources: SOURCES, targetPath: TARGET_PATH },
      vaultPath: getTemporaryVault().path
    });
  });

  it('should index both a wikilink and a markdown link in a property as a backlink of the target', async () => {
    const backlinkPaths = await evalInObsidian({
      callback({ app, targetPath }): string[] {
        const target = app.vault.getFileByPath(targetPath);
        if (!target) {
          throw new Error(`Missing ${targetPath}`);
        }

        return [...app.metadataCache.getBacklinksForFile(target).keys()].sort();
      },
      input: { targetPath: TARGET_PATH },
      vaultPath: getTemporaryVault().path
    });

    expect(backlinkPaths).toEqual([MARKDOWN_SOURCE_PATH, WIKILINK_SOURCE_PATH]);
  });

  it('should match both in a Bases file.hasLink filter', async () => {
    const rows = await queryBase('file.hasLink(link("frontmatter-markdown-link/Target with space.md"))');
    expect(rows).toEqual([MARKDOWN_SOURCE_PATH, WIKILINK_SOURCE_PATH]);
  });

  it('should match only the wikilink when a Bases filter compares the property with a link', async () => {
    const rows = await queryBase('related == link("frontmatter-markdown-link/Target with space.md")');
    expect(rows).toEqual([WIKILINK_SOURCE_PATH]);
  });
});

/**
 * Writes a base with the single `filter`, scoped to the suite's folder, opens it and returns the source
 * notes it lists.
 *
 * @param filter - A Bases filter expression.
 * @returns The paths of the suite's source notes the table shows, sorted.
 */
async function queryBase(filter: string): Promise<string[]> {
  return evalInObsidian({
    async callback({ app, filter: baseFilter, folderPath, sourcePaths }): Promise<string[]> {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 10_000;
      const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;
      // Long enough for a table that is still filling to add its last row.
      const ROWS_SETTLE_IN_MILLISECONDS = 1000;

      const basePath = `${folderPath}/query.base`;
      const existing = app.vault.getAbstractFileByPath(basePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }

      const baseFile = await app.vault.create(
        basePath,
        `filters:\n  and:\n    - file.inFolder("${folderPath}")\n    - '${baseFilter}'\nviews:\n  - type: table\n    name: Table\n`
      );
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(baseFile);

      const start = performance.now();
      while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
        if (/\d+ results?/u.test(leaf.view.containerEl.querySelector('.bases-toolbar-result-count')?.textContent ?? '')) {
          break;
        }

        await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
      }

      await sleep(ROWS_SETTLE_IN_MILLISECONDS);
      const text = leaf.view.containerEl.querySelector('.view-content')?.textContent ?? '';
      return sourcePaths.filter((path) => {
        const basename = path.slice(path.lastIndexOf('/') + 1, -'.md'.length);
        return text.includes(basename);
      }).sort();
    },
    input: { filter, folderPath: FOLDER_PATH, sourcePaths: Object.keys(SOURCES) },
    vaultPath: getTemporaryVault().path
  });
}
