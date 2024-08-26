import type { TFile } from "obsidian";
import type BetterMarkdownLinksPlugin from "./BetterMarkdownLinksPlugin.ts";
import {
  generateMarkdownLink as generateMarkdownLinkFull,
  type GenerateMarkdownLinkOptions as GenerateMarkdownLinkFullOptions
} from "obsidian-dev-utils/obsidian/Link";

export type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

export type GenerateMarkdownLinkForPluginOptions = Omit<GenerateMarkdownLinkFullOptions, "app">;

export function generateMarkdownLinkForPlugin(plugin: BetterMarkdownLinksPlugin, options: GenerateMarkdownLinkForPluginOptions): string {
  const settings = plugin.settingsCopy;
  const fullOptions = Object.assign(options, {
    app: plugin.app,
    isWikilink: settings.ignoreIncompatibleObsidianSettings ? false : undefined,
    isRelative: settings.ignoreIncompatibleObsidianSettings ? true : undefined,
    useLeadingDot: settings.useLeadingDot,
    useAngleBrackets: settings.useAngleBrackets
  } as GenerateMarkdownLinkFullOptions);
  return generateMarkdownLinkFull(fullOptions);
}
