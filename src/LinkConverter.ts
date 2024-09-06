import type {
  ReferenceCache,
  TFile
} from 'obsidian';
import {
  App,
  Notice
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';
import { emitAsyncErrorEvent } from 'obsidian-dev-utils/Error';
import { splitSubpath } from 'obsidian-dev-utils/obsidian/Link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/MetadataCache';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/TAbstractFile';
import { applyFileChanges } from 'obsidian-dev-utils/obsidian/Vault';
import type { LinkChangeUpdate } from 'obsidian-typings';

import type BetterMarkdownLinksPlugin from './BetterMarkdownLinksPlugin.ts';
import { generateMarkdownLinkForPlugin } from './GenerateMarkdownLink.ts';
import { checkObsidianSettingsCompatibility } from './ObsidianSettings.ts';

export function convertLinksInCurrentFile(plugin: BetterMarkdownLinksPlugin, checking: boolean): boolean {
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile || !isMarkdownFile(activeFile)) {
    return false;
  }

  if (!checking) {
    invokeAsyncSafely(convertLinksInFile(plugin, activeFile));
  }

  return true;
}

export async function convertLinksInFile(plugin: BetterMarkdownLinksPlugin, file: TFile): Promise<void> {
  if (!checkObsidianSettingsCompatibility(plugin)) {
    return;
  }

  await applyFileChanges(plugin.app, file, async () => {
    const cache = await getCacheSafe(plugin.app, file);
    if (!cache) {
      return [];
    }
    return getAllLinks(cache).map((link) => ({
      startIndex: link.position.start.offset,
      endIndex: link.position.end.offset,
      oldContent: link.original,
      newContent: convertLink(plugin, link, file)
    }));
  });
}

export async function convertLinksInEntireVault(plugin: BetterMarkdownLinksPlugin): Promise<void> {
  if (!checkObsidianSettingsCompatibility(plugin)) {
    return;
  }

  const mdFiles = plugin.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));

  let index = 0;

  const notice = new Notice('', 0);

  for (const file of mdFiles) {
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

export async function applyLinkChangeUpdates(plugin: BetterMarkdownLinksPlugin, file: TFile, updates: LinkChangeUpdate[]): Promise<void> {
  await applyFileChanges(plugin.app, file, async () => {
    const changes = updates.map((update) => ({
      startIndex: update.reference.position.start.offset,
      endIndex: update.reference.position.end.offset,
      oldContent: update.reference.original,
      newContent: fixChange(plugin, update.change, file)
    }));

    const content = await plugin.app.vault.read(file);
    const doUpdatesMatchContent = changes.every((change) => content.slice(change.startIndex, change.endIndex) === change.oldContent);
    return doUpdatesMatchContent ? changes : [];
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

  return generateMarkdownLinkForPlugin(plugin, {
    pathOrFile: linkedFile,
    sourcePathOrFile: file.path,
    subpath,
    alias,
    isEmbed,
    isWikilink: false
  });
}

export async function updateLinksInFile(plugin: BetterMarkdownLinksPlugin, file: TFile, oldPath: string): Promise<void> {
  const app = plugin.app;
  await applyFileChanges(app, file, async () => {
    const cache = await getCacheSafe(app, file);
    if (!cache) {
      return [];
    }
    return getAllLinks(cache).map((link) => ({
      startIndex: link.position.start.offset,
      endIndex: link.position.end.offset,
      oldContent: link.original,
      newContent: convertLink(plugin, link, file, oldPath)
    }));
  });
}

export function extractLinkFile(app: App, link: ReferenceCache, oldPath: string): TFile | null {
  const PARENT_DIRECTORY = '../';

  const { linkPath } = splitSubpath(link.link);
  let linkFile = app.metadataCache.getFirstLinkpathDest(linkPath, oldPath);
  if (!linkFile && linkPath.startsWith(PARENT_DIRECTORY)) {
    linkFile = app.metadataCache.getFirstLinkpathDest(linkPath.slice(PARENT_DIRECTORY.length), oldPath);
  }

  return linkFile;
}

export function updateLink(plugin: BetterMarkdownLinksPlugin, link: ReferenceCache, file: TFile | null, source: TFile): string {
  if (!file) {
    return link.original;
  }
  const isEmbed = link.original.startsWith('!');
  const isWikilink = plugin.settingsCopy.automaticallyConvertNewLinks ? undefined : link.original.includes('[[');
  const { subpath } = splitSubpath(link.link);
  return generateMarkdownLinkForPlugin(plugin, {
    pathOrFile: file,
    sourcePathOrFile: source,
    subpath,
    alias: link.displayText,
    isEmbed,
    isWikilink
  });
}

export function convertLink(plugin: BetterMarkdownLinksPlugin, link: ReferenceCache, source: TFile, oldPath?: string): string {
  oldPath ??= source.path;
  return updateLink(plugin, link, extractLinkFile(plugin.app, link, oldPath), source);
}
