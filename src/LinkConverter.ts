import {
  App,
  Notice,
  type ReferenceCache,
  type TFile
} from "obsidian";
import type BetterMarkdownLinksPlugin from "./BetterMarkdownLinksPlugin.ts";
import { checkObsidianSettingsCompatibility } from "./ObsidianSettings.ts";
import {
  getAllLinks,
  getCacheSafe
} from "./MetadataCache.ts";
import { applyFileChanges } from "./Vault.ts";
import { isMarkdownFile } from "./TFile.ts";
import { convertToSync } from "./Async.ts";
import { showError } from "./Error.ts";
import { generateMarkdownLink } from "./GenerateMarkdownLink.ts";
import type { LinkChangeUpdate } from "obsidian-typings";

export function convertLinksInCurrentFile(plugin: BetterMarkdownLinksPlugin, checking: boolean): boolean {
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile || !isMarkdownFile(activeFile)) {
    return false;
  }

  if (!checking) {
    convertToSync(convertLinksInFile(plugin, activeFile));
  }

  return true;
}

export async function convertLinksInFile(plugin: BetterMarkdownLinksPlugin, file: TFile): Promise<void> {
  if (!checkObsidianSettingsCompatibility(plugin)) {
    return;
  }

  await applyFileChanges(plugin.app, file, async () => getAllLinks(await getCacheSafe(plugin.app, file)).map(link => ({
    startIndex: link.position.start.offset,
    endIndex: link.position.end.offset,
    newContent: convertLink(plugin, link, file)
  })));
}

export async function convertLinksInEntireVault(plugin: BetterMarkdownLinksPlugin): Promise<void> {
  if (!checkObsidianSettingsCompatibility(plugin)) {
    return;
  }

  const mdFiles = plugin.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));

  let index = 0;

  const notice = new Notice("", 0);

  for (const file of mdFiles) {
    index++;
    const message = `Converting links in note # ${index} / ${mdFiles.length}: ${file.path}`;
    notice.setMessage(message);
    console.log(message);
    try {
      await convertLinksInFile(plugin, file);
    }
    catch (e) {
      showError(e);
    }
  }

  notice.hide();
}

export async function applyLinkChangeUpdates(plugin: BetterMarkdownLinksPlugin, file: TFile, updates: LinkChangeUpdate[]): Promise<void> {
  await applyFileChanges(plugin.app, file, () => updates.map(update => ({
    startIndex: update.reference.position.start.offset,
    endIndex: update.reference.position.end.offset,
    newContent: fixChange(plugin, update.change, file)
  })));
}

/**
 * BUG: https://forum.obsidian.md/t/update-internal-link-breaks-links-with-angle-brackets/85598
 */
export function fixChange(plugin: BetterMarkdownLinksPlugin, change: string, file: TFile): string {
  const match = change.match(/^!?\[(.*?)\]\(([^<]+?) .+?>\)$/);
  const isEmbed = change.startsWith("!");

  if (!match) {
    return change;
  }

  const alias = match[1]!;
  const escapedPath = match[2]!;
  const [linkPath = "", originalSubpath] = decodeURIComponent(escapedPath).split("#");
  const linkedFile = plugin.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
  if (!linkedFile) {
    return `${isEmbed ? "!" : ""}[${alias}](${escapedPath})`;
  }

  const subpath = originalSubpath ? "#" + originalSubpath : undefined;
  return generateMarkdownLink(plugin, linkedFile, file.path, subpath, alias, isEmbed, false);
}

export async function updateLinksInFile(plugin: BetterMarkdownLinksPlugin, file: TFile, oldPath: string): Promise<void> {
  const app = plugin.app;
  await applyFileChanges(app, file, async () => getAllLinks(await getCacheSafe(app, file)).map(link => ({
    startIndex: link.position.start.offset,
    endIndex: link.position.end.offset,
    newContent: convertLink(plugin, link, file, oldPath)
  })));
}

export function extractLinkFile(app: App, link: ReferenceCache, oldPath: string): TFile | null {
  const PARENT_DIRECTORY = "../";

  const [linkPath = ""] = link.link.split("#");
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
  const isEmbed = link.original.startsWith("!");
  const isWikilink = plugin.settings.automaticallyConvertNewLinks ? undefined :  link.original.includes("[[");
  const originalSubpath = link.link.split("#")[1];
  const subpath = originalSubpath ? "#" + originalSubpath : undefined;
  return generateMarkdownLink(plugin, file, source.path, subpath, link.displayText, isEmbed, isWikilink);
}

export function convertLink(plugin: BetterMarkdownLinksPlugin, link: ReferenceCache, source: TFile, oldPath?: string): string {
  oldPath ??= source.path;
  return updateLink(plugin, link, extractLinkFile(plugin.app, link, oldPath), source);
}
