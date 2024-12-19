import type { TFile } from 'obsidian';
import type { LinkChangeUpdate } from 'obsidian-typings';

import { applyFileChanges } from 'obsidian-dev-utils/obsidian/FileChange';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/FileSystem';
import {
  generateMarkdownLink,
  splitSubpath,
  updateLinksInFile
} from 'obsidian-dev-utils/obsidian/Link';
import { loop } from 'obsidian-dev-utils/obsidian/Loop';
import { confirm } from 'obsidian-dev-utils/obsidian/Modal/Confirm';
import { addToQueue } from 'obsidian-dev-utils/obsidian/Queue';
import { getMarkdownFilesSorted } from 'obsidian-dev-utils/obsidian/Vault';

import type { BetterMarkdownLinksPlugin } from './BetterMarkdownLinksPlugin.ts';

import { checkObsidianSettingsCompatibility } from './ObsidianSettings.ts';

export async function applyLinkChangeUpdates(plugin: BetterMarkdownLinksPlugin, file: TFile, updates: LinkChangeUpdate[]): Promise<void> {
  await applyFileChanges(plugin.app, file, async () => {
    const changes = updates.map((update) => ({
      endIndex: update.reference.position.end.offset,
      newContent: fixChange(plugin, update.change, file),
      oldContent: update.reference.original,
      startIndex: update.reference.position.start.offset
    }));

    const content = await plugin.app.vault.read(file);
    const doUpdatesMatchContent = changes.every((change) => content.slice(change.startIndex, change.endIndex) === change.oldContent);
    return doUpdatesMatchContent ? changes : [];
  });
}

export function convertLinksInCurrentFile(plugin: BetterMarkdownLinksPlugin, checking: boolean): boolean {
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile || !isMarkdownFile(plugin.app, activeFile)) {
    return false;
  }

  if (!checking) {
    addToQueue(plugin.app, () => convertLinksInFile(plugin, activeFile, true));
  }

  return true;
}

export async function convertLinksInEntireVault(plugin: BetterMarkdownLinksPlugin, abortSignal: AbortSignal): Promise<void> {
  if (!checkObsidianSettingsCompatibility(plugin)) {
    return;
  }

  await loop({
    abortSignal,
    buildNoticeMessage: (file, iterationStr) => `Converting links in note ${iterationStr} - ${file.path}`,
    items: getMarkdownFilesSorted(plugin.app),
    processItem: async (file) => {
      await convertLinksInFile(plugin, file);
    },
    shouldContinueOnError: true
  });
}

export async function convertLinksInFile(plugin: BetterMarkdownLinksPlugin, file: TFile, shouldPromptForExcludedFile?: boolean): Promise<void> {
  if (!checkObsidianSettingsCompatibility(plugin)) {
    return;
  }

  if (plugin.settingsCopy.isPathIgnored(file.path)) {
    if (!shouldPromptForExcludedFile) {
      return;
    }

    const shouldConvert = await confirm({ app: plugin.app, message: `Note '${file.path}' is excluded from the conversion in plugin settings. Do you want to convert it anyway?` });
    if (!shouldConvert) {
      return;
    }
  }

  await updateLinksInFile({
    app: plugin.app,
    newSourcePathOrFile: file
  });
}

/**
 * BUG: https://forum.obsidian.md/t/update-internal-link-breaks-links-with-angle-brackets/85598
 */
export function fixChange(plugin: BetterMarkdownLinksPlugin, change: string, sourceFile: TFile): string {
  const match = /^!?\[(.*?)\]\(([^<]+?) .+?>\)$/.exec(change);
  const isEmbed = change.startsWith('!');

  if (!match) {
    return change;
  }

  const alias = match[1] ?? '';
  const escapedPath = match[2] ?? '';
  const { linkPath, subpath } = splitSubpath(decodeURIComponent(escapedPath));
  const targetFile = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourceFile.path);
  if (!targetFile) {
    return `${isEmbed ? '!' : ''}[${alias}](${escapedPath})`;
  }

  return generateMarkdownLink({
    alias,
    app: plugin.app,
    isEmbed,
    isWikilink: false,
    sourcePathOrFile: sourceFile,
    subpath,
    targetPathOrFile: targetFile
  });
}
