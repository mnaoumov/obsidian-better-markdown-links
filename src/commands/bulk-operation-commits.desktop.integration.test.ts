/**
 * @file
 *
 * Integration suite for bulk-operation commits: with `shouldCommitBulkOperations` on and the vault inside a git
 * work tree, an in-folder command lands as `chore: before OP<n>` (what was pending) followed by
 * `OP<n>: <command> in <folder>` (what the run changed), and `git revert` of the second commit puts the notes back.
 *
 * The shared temporary vault is made a git work tree for this suite only, and its `.git` is removed again
 * afterwards, so no other suite runs against a repository. The config folder is ignored, because the workspace file
 * Obsidian keeps rewriting would otherwise land in the operation's commit and make its revert conflict.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project: the commits
 * need the system `git`, which only the desktop app reaches.
 */

import type {
  SettingTab,
  TFile
} from 'obsidian';

import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
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

/**
 * The (otherwise protected) settings component exposed for the test, letting it change settings the
 * same way the plugin's own settings UI does.
 */
interface TestableSettingsComponent {
  readonly editAndSave: (settingsEditor: (settings: PluginSettings) => Promise<void> | void) => Promise<void>;
  readonly settings: PluginSettings;
}

/**
 * The plugin's settings tab, exposing its settings component.
 */
interface TestableSettingsTab extends SettingTab {
  readonly pluginSettingsComponent: TestableSettingsComponent;
}

const PLUGIN_ID = 'better-markdown-links';
const FOLDER_PATH = 'bulk-operation-commits';
const SOURCE_PATH = `${FOLDER_PATH}/source.md`;
const TARGET_PATH = `${FOLDER_PATH}/target.md`;
const SOURCE_CONTENT = '[[target]]\n';
// Any Markdown form will do: what the suite checks is the commits around the conversion, not its style.
const CONVERTED_LINK_PREFIX = '[target](';
const COMMIT_WAIT_TIMEOUT_IN_MILLISECONDS = 30_000;
const COMMIT_POLL_INTERVAL_IN_MILLISECONDS = 200;

let vaultPath: string;

function git(...gitArguments: string[]): string {
  return execFileSync('git', gitArguments, { cwd: vaultPath, encoding: 'utf-8' }).trim();
}

beforeAll(async () => {
  vaultPath = getTemporaryVault().path;
  const configDirectory = await evalInObsidian({
    callback({ app }): string {
      return app.vault.configDir;
    },
    vaultPath
  });
  git('init', '--quiet', '--initial-branch=main');
  // Hooks from the machine's global config must not decide whether the suite's commits land.
  const hooksPath = join(vaultPath, '.git', 'test-hooks');
  mkdirSync(hooksPath);
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgSign', 'false');
  // A global core.autocrlf would check the reverted note out with CRLF line endings.
  git('config', 'core.autocrlf', 'false');
  git('config', 'core.hooksPath', hooksPath);
  writeFileSync(join(vaultPath, '.gitignore'), `${configDirectory}/\n`);
  git('add', '-A');
  git('commit', '--quiet', '-m', 'chore: vault before the suite');
});

afterAll(async () => {
  // Turned off only once the operation's commit has landed: the commit is made after the vault goes quiet,
  // well after the conversion the test waits for.
  await evalInObsidian({
    async callback({ app, defaultMode, folderPath, pluginId }): Promise<void> {
      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      await (settingTab as TestableSettingsTab | undefined)?.pluginSettingsComponent.editAndSave((settings) => {
        settings.linkConversionMode = defaultMode;
        settings.shouldCommitBulkOperations = false;
      });
      const folder = app.vault.getFolderByPath(folderPath);
      if (folder) {
        await app.fileManager.trashFile(folder);
      }
    },
    // The plugin's default, which every other suite starts from.
    input: { defaultMode: LinkConversionMode.OnSaveCommand, folderPath: FOLDER_PATH, pluginId: PLUGIN_ID },
    vaultPath
  });
  rmSync(join(vaultPath, '.git'), { force: true, recursive: true });
  rmSync(join(vaultPath, '.gitignore'), { force: true });
});

describe('bulk operation commits (Desktop)', () => {
  it('should record an in-folder conversion as two commits that a revert undoes', async () => {
    const convertedContent = await runConvertLinksInFolder();
    expect(convertedContent).toContain(CONVERTED_LINK_PREFIX);

    const operationCommitSha = await waitForOperationCommit();
    const subjects = git('log', '--format=%s', '-2', operationCommitSha).split('\n');
    const operationId = /^(?<operationId>OP\d+): /u.exec(subjects[0] ?? '')?.groups?.['operationId'];
    expect(subjects).toEqual([
      `${operationId ?? 'OP?'}: Convert links in ${FOLDER_PATH}`,
      `chore: before ${operationId ?? 'OP?'}`
    ]);
    expect(git('show', '--name-only', '--format=', operationCommitSha)).toBe(SOURCE_PATH);
    expect(git('show', '--format=%B', '--no-patch', operationCommitSha)).toContain(`Obsidian-Plugin: ${PLUGIN_ID}`);

    git('revert', '--no-edit', operationCommitSha);

    expect(await readFromVault(SOURCE_PATH)).toBe(SOURCE_CONTENT);
    expect(git('status', '--porcelain')).toBe('');
  });
});

/**
 * Reads a note the way the vault sees it after git rewrote it from outside.
 *
 * @param path - The note's vault path.
 * @returns Its content.
 */
async function readFromVault(path: string): Promise<string> {
  return evalInObsidian({
    async callback({ app, notePath }): Promise<string> {
      return await app.vault.adapter.read(notePath);
    },
    input: { notePath: path },
    vaultPath
  });
}

/**
 * Turns the commits on, creates the two notes, opens the source so the folder command has a current folder,
 * runs `Convert links in current folder`, and returns the source once the conversion is on disk.
 *
 * @returns The converted source.
 */
async function runConvertLinksInFolder(): Promise<string> {
  return evalInObsidian({
    async callback({ app, convertedLinkPrefix, folderPath, mode, pluginId, sourceContent, sourcePath, targetPath }): Promise<string> {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 10_000;
      const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;

      app.vault.setConfig('useMarkdownLinks', true);
      app.vault.setConfig('newLinkFormat', 'relative');

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkConversionMode = mode;
        settings.shouldCommitBulkOperations = true;
      });

      await app.vault.createFolder(folderPath);
      await app.vault.create(targetPath, 'Target\n');
      const sourceFile = await app.vault.create(sourcePath, sourceContent);
      await waitForIndexedLink(sourceFile);

      await app.workspace.getLeaf(false).openFile(sourceFile);
      app.commands.executeCommandById(`${pluginId}:convert-links-in-current-folder`);

      const start = performance.now();
      let content = await app.vault.adapter.read(sourcePath);
      while (!content.includes(convertedLinkPrefix) && performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
        await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        content = await app.vault.adapter.read(sourcePath);
      }

      return content;

      async function waitForIndexedLink(file: TFile): Promise<void> {
        const indexStart = performance.now();
        while (performance.now() - indexStart < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          if ((app.metadataCache.getFileCache(file)?.links?.length ?? 0) > 0) {
            return;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        throw new Error(`Metadata cache never indexed a link in ${file.path}`);
      }
    },
    input: {
      convertedLinkPrefix: CONVERTED_LINK_PREFIX,
      folderPath: FOLDER_PATH,
      mode: LinkConversionMode.OnExplicitCommand,
      pluginId: PLUGIN_ID,
      sourceContent: SOURCE_CONTENT,
      sourcePath: SOURCE_PATH,
      targetPath: TARGET_PATH
    },
    vaultPath
  });
}

/**
 * Waits for the operation's commit, which lands only after the vault has gone quiet following the run.
 *
 * @returns The commit's sha.
 */
async function waitForOperationCommit(): Promise<string> {
  const start = performance.now();
  while (performance.now() - start < COMMIT_WAIT_TIMEOUT_IN_MILLISECONDS) {
    const sha = git('log', '--format=%H', '-1', '--grep=^OP[0-9]+: ', '--extended-regexp');
    if (sha) {
      return sha;
    }

    await delay(COMMIT_POLL_INTERVAL_IN_MILLISECONDS);
  }

  throw new Error(`No OP commit appeared within ${String(COMMIT_WAIT_TIMEOUT_IN_MILLISECONDS)} ms`);
}
