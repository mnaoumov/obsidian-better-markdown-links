import type { TFile } from "obsidian";
import type BetterMarkdownLinksPlugin from "./BetterMarkdownLinksPlugin.ts";
import {
  generateMarkdownLink as generateMarkdownLinkFull,
  type GenerateMarkdownLinkOptions as GenerateMarkdownLinkFullOptions
} from "obsidian-dev-utils/obsidian/Link";

export type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

export type GenerateMarkdownLinkForPluginOptions = Omit<GenerateMarkdownLinkFullOptions, "app">;

export function generateMarkdownLinkForPlugin(plugin: BetterMarkdownLinksPlugin, options: GenerateMarkdownLinkForPluginOptions): string {
  const pluginSettings = plugin.settingsCopy;
  const optionsFromPluginSettings: Partial<GenerateMarkdownLinkFullOptions> = {
    isWikilink: pluginSettings.ignoreIncompatibleObsidianSettings ? false : undefined,
    forceRelativePath: pluginSettings.ignoreIncompatibleObsidianSettings ? true : undefined,
    useLeadingDot: pluginSettings.useLeadingDot,
    useAngleBrackets: pluginSettings.useAngleBrackets
  };
  const fullOptions = Object.assign({ app: plugin.app }, optionsFromPluginSettings, options);
  return generateMarkdownLinkFull(fullOptions);
}
