import type { TFile } from 'obsidian';
import type { LinkChangeUpdate } from 'obsidian-typings';

import { Notice } from 'obsidian';
import { emitAsyncErrorEvent } from 'obsidian-dev-utils/Error';
import { applyFileChanges } from 'obsidian-dev-utils/obsidian/FileChange';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/FileSystem';
import {
  generateMarkdownLink,
  splitSubpath,
  updateLinksInFile
} from 'obsidian-dev-utils/obsidian/Link';
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
  if (!activeFile || !isMarkdownFile(activeFile)) {
    return false;
  }

  if (!checking) {
    addToQueue(plugin.app, () => convertLinksInFile(plugin, activeFile));
  }

  return true;
}

export async function convertLinksInEntireVault(plugin: BetterMarkdownLinksPlugin, abortSignal: AbortSignal): Promise<void> {
  if (!checkObsidianSettingsCompatibility(plugin)) {
    return;
  }

  const mdFiles = getMarkdownFilesSorted(plugin.app);

  let index = 0;

  const notice = new Notice('', 0);

  for (const file of mdFiles) {
    if (abortSignal.aborted) {
      break;
    }
    index++;
    const message = `Converting links in note # ${index.toString()} / ${mdFiles.length.toString()}: ${file.path}`;
    notice.setMessage(message);
    console.log(message);
    try {
      await convertLinksInFile(plugin, file);
    } catch (e) {
      emitAsyncErrorEvent(e);
    }
  }

  notice.hide();
}

export async function convertLinksInFile(plugin: BetterMarkdownLinksPlugin, file: TFile): Promise<void> {
  if (!checkObsidianSettingsCompatibility(plugin)) {
    return;
  }

  await updateLinksInFile({
    app: plugin.app,
    pathOrFile: file
  });
}

/**
 * BUG: https://forum.obsidian.md/t/update-internal-link-breaks-links-with-angle-brackets/85598
 */
export function fixChange(plugin: BetterMarkdownLinksPlugin, change: string, file: TFile): string {
  const match = /^!?\[(.*?)\]\(([^<]+?) .+?>\)$/.exec(change);
  const isEmbed = change.startsWith('!');

  if (!match) {
    return change;
  }

  const alias = match[1] ?? '';
  const escapedPath = match[2] ?? '';
  const { linkPath, subpath } = splitSubpath(decodeURIComponent(escapedPath));
  const linkedFile = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
  if (!linkedFile) {
    return `${isEmbed ? '!' : ''}[${alias}](${escapedPath})`;
  }

  return generateMarkdownLink({
    alias,
    app: plugin.app,
    isEmbed,
    isWikilink: false,
    pathOrFile: linkedFile,
    sourcePathOrFile: file,
    subpath
  });
}
