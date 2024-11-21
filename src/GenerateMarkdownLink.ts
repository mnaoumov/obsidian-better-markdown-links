import type {
  GenerateMarkdownLinkDefaultOptionsWrapper,
  GenerateMarkdownLinkOptions as GenerateMarkdownLinkFullOptions
} from 'obsidian-dev-utils/obsidian/Link';

import { TFile } from 'obsidian';
import { generateMarkdownLink as generateMarkdownLinkFull } from 'obsidian-dev-utils/obsidian/Link';

import type { BetterMarkdownLinksPlugin } from './BetterMarkdownLinksPlugin.ts';

export type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

type GenerateMarkdownLinkForPluginOptions = Omit<GenerateMarkdownLinkFullOptions, 'app'>;

export function getPatchedGenerateMarkdownLink(plugin: BetterMarkdownLinksPlugin): GenerateMarkdownLinkDefaultOptionsWrapper & GenerateMarkdownLinkFn {
  const generateMarkdownLinkFn: GenerateMarkdownLinkFn = (fileOrOptions, sourcePath, subpath, alias): string => generateMarkdownLinkForPlugin(plugin, fileOrOptions, sourcePath, subpath, alias);
  const generateMarkdownLinkDefaultOptionsWrapper: GenerateMarkdownLinkDefaultOptionsWrapper = {
    defaultOptionsFn: () => getDefaultOptions(plugin)
  };
  return Object.assign(generateMarkdownLinkFn, generateMarkdownLinkDefaultOptionsWrapper);
}

function generateMarkdownLinkForPlugin(plugin: BetterMarkdownLinksPlugin, fileOrOptions: GenerateMarkdownLinkForPluginOptions | TFile, sourcePath: string, subpath?: string, alias?: string): string {
  let options: GenerateMarkdownLinkForPluginOptions;
  if (fileOrOptions instanceof TFile) {
    options = {
      alias,
      pathOrFile: fileOrOptions,
      sourcePathOrFile: sourcePath,
      subpath
    };
  } else {
    options = fileOrOptions;
  }
  return generateMarkdownLinkFull({ app: plugin.app, ...options });
}

function getDefaultOptions(plugin: BetterMarkdownLinksPlugin): Partial<GenerateMarkdownLinkFullOptions> {
  const pluginSettings = plugin.settingsCopy;
  return {
    allowEmptyEmbedAlias: pluginSettings.allowEmptyEmbedAlias,
    forceRelativePath: pluginSettings.ignoreIncompatibleObsidianSettings ? true : undefined,
    includeAttachmentExtensionToEmbedAlias: pluginSettings.includeAttachmentExtensionToEmbedAlias,
    isWikilink: pluginSettings.ignoreIncompatibleObsidianSettings ? false : undefined,
    useAngleBrackets: pluginSettings.useAngleBrackets,
    useLeadingDot: pluginSettings.useLeadingDot
  };
}
