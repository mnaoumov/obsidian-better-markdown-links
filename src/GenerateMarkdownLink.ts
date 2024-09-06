import type { TFile } from 'obsidian';
import type { GenerateMarkdownLinkOptions as GenerateMarkdownLinkFullOptions } from 'obsidian-dev-utils/obsidian/Link';
import { generateMarkdownLink as generateMarkdownLinkFull } from 'obsidian-dev-utils/obsidian/Link';

import type BetterMarkdownLinksPlugin from './BetterMarkdownLinksPlugin.ts';

export type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

export type GenerateMarkdownLinkForPluginOptions = Omit<GenerateMarkdownLinkFullOptions, 'app'>;

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
