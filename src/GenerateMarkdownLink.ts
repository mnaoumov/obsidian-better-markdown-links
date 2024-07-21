import type { TFile } from "obsidian";
import type BetterMarkdownLinksPlugin from "./BetterMarkdownLinksPlugin.ts";
import {
  dirname,
  relative
} from "node:path/posix";
import {
  isMarkdownFile,
  trimMarkdownExtension
} from "./TFile.ts";
import {
  shouldUseRelativeLinks,
  shouldUseWikilinks
} from "./ObsidianSettings.ts";

export type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

const SPECIAL_LINK_SYMBOLS_REGEXP = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

export function generateMarkdownLink(plugin: BetterMarkdownLinksPlugin, file: TFile, sourcePath: string, subpath?: string, alias?: string, isEmbed?: boolean, isWikilink?: boolean): string {
  const app = plugin.app;
  const settings = plugin.settings;

  subpath ??= "";
  alias ??= "";
  isEmbed ??= !isMarkdownFile(file);
  isWikilink ??= !settings.ignoreIncompatibleObsidianSettings && shouldUseWikilinks(app);
  const useRelativePath = settings.ignoreIncompatibleObsidianSettings || shouldUseRelativeLinks(app);

  let linkText = file.path === sourcePath && subpath
    ? subpath
    : useRelativePath
      ? relative(dirname(sourcePath), isWikilink ? trimMarkdownExtension(file) : file.path) + subpath
      : app.metadataCache.fileToLinktext(file, sourcePath, isWikilink) + subpath;

  if (useRelativePath && settings.useLeadingDot && !linkText.startsWith(".") && !linkText.startsWith("#")) {
    linkText = "./" + linkText;
  }

  if (!isWikilink) {
    if (settings.useAngleBrackets) {
      linkText = `<${linkText}>`;
    } else {
      linkText = linkText.replace(SPECIAL_LINK_SYMBOLS_REGEXP, function (specialLinkSymbol) {
        return encodeURIComponent(specialLinkSymbol);
      });
    }

    if (!isEmbed) {
      return `[${alias || file.basename}](${linkText})`;
    } else {
      return `![${alias}](${linkText})`;
    }
  } else {
    if (alias && alias.toLowerCase() === linkText.toLowerCase()) {
      linkText = alias;
      alias = "";
    }

    return (isEmbed ? "!" : "") + (alias ? `[[${linkText}|${alias}]]` : `[[${linkText}]]`);
  }
}
