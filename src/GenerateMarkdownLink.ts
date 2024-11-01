import { TFile } from 'obsidian';
import type {
  GenerateMarkdownLinkDefaultOptionsWrapper,
  GenerateMarkdownLinkOptions as GenerateMarkdownLinkFullOptions
} from 'obsidian-dev-utils/obsidian/Link';
import { generateMarkdownLink as generateMarkdownLinkFull } from 'obsidian-dev-utils/obsidian/Link';

import type BetterMarkdownLinksPlugin from './BetterMarkdownLinksPlugin.ts';

export type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

type GenerateMarkdownLinkForPluginOptions = Omit<GenerateMarkdownLinkFullOptions, 'app'>;

function getDefaultOptions(plugin: BetterMarkdownLinksPlugin): Partial<GenerateMarkdownLinkFullOptions> {
  const pluginSettings = plugin.settingsCopy;
  return {
    isWikilink: pluginSettings.ignoreIncompatibleObsidianSettings ? false : undefined,
    forceRelativePath: pluginSettings.ignoreIncompatibleObsidianSettings ? true : undefined,
    useLeadingDot: pluginSettings.useLeadingDot,
    useAngleBrackets: pluginSettings.useAngleBrackets,
    allowEmptyEmbedAlias: pluginSettings.allowEmptyEmbedAlias,
    includeAttachmentExtensionToEmbedAlias: pluginSettings.includeAttachmentExtensionToEmbedAlias
  };
}

function generateMarkdownLinkForPlugin(plugin: BetterMarkdownLinksPlugin, fileOrOptions: TFile | GenerateMarkdownLinkForPluginOptions, sourcePath: string, subpath?: string, alias?: string): string {
  let options: GenerateMarkdownLinkForPluginOptions;
  if (fileOrOptions instanceof TFile) {
    options = {
      pathOrFile: fileOrOptions,
      sourcePathOrFile: sourcePath,
      subpath,
      alias
    };
  } else {
    options = fileOrOptions;
  }
  return generateMarkdownLinkFull({ app: plugin.app, ...options });
}

export function getPatchedGenerateMarkdownLink(plugin: BetterMarkdownLinksPlugin): GenerateMarkdownLinkFn & GenerateMarkdownLinkDefaultOptionsWrapper {
  const generateMarkdownLinkFn: GenerateMarkdownLinkFn = (fileOrOptions, sourcePath, subpath, alias): string => generateMarkdownLinkForPlugin(plugin, fileOrOptions, sourcePath, subpath, alias);
  const generateMarkdownLinkDefaultOptionsWrapper: GenerateMarkdownLinkDefaultOptionsWrapper = {
    defaultOptionsFn: () => getDefaultOptions(plugin)
  };
  return Object.assign(generateMarkdownLinkFn, generateMarkdownLinkDefaultOptionsWrapper);
}
