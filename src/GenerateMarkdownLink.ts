import type {
  GenerateMarkdownLinkDefaultOptionsWrapper,
  GenerateMarkdownLinkOptions as GenerateMarkdownLinkFullOptions
} from 'obsidian-dev-utils/obsidian/Link';

import { TFile } from 'obsidian';
import { normalizeOptionalProperties } from 'obsidian-dev-utils/Object';
import { generateMarkdownLink as generateMarkdownLinkFull } from 'obsidian-dev-utils/obsidian/Link';

import type { BetterMarkdownLinksPlugin } from './BetterMarkdownLinksPlugin.ts';

export type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

type GenerateMarkdownLinkForPluginOptions = Omit<GenerateMarkdownLinkFullOptions, 'app'>;

export function getPatchedGenerateMarkdownLink(plugin: BetterMarkdownLinksPlugin): GenerateMarkdownLinkDefaultOptionsWrapper & GenerateMarkdownLinkFn {
  const generateMarkdownLinkFn: GenerateMarkdownLinkFn = (fileOrOptions, sourcePath, subpath, alias): string =>
    generateMarkdownLinkForPlugin(plugin, fileOrOptions, sourcePath, subpath, alias);
  const generateMarkdownLinkDefaultOptionsWrapper: GenerateMarkdownLinkDefaultOptionsWrapper = {
    defaultOptionsFn: () => getDefaultOptions(plugin)
  };
  return Object.assign(generateMarkdownLinkFn, generateMarkdownLinkDefaultOptionsWrapper) as GenerateMarkdownLinkDefaultOptionsWrapper & GenerateMarkdownLinkFn;
}

function generateMarkdownLinkForPlugin(
  plugin: BetterMarkdownLinksPlugin,
  fileOrOptions: GenerateMarkdownLinkForPluginOptions | TFile,
  sourcePath: string,
  subpath?: string,
  alias?: string
): string {
  let options: GenerateMarkdownLinkForPluginOptions;
  if (fileOrOptions instanceof TFile) {
    options = normalizeOptionalProperties<GenerateMarkdownLinkForPluginOptions>({
      alias,
      sourcePathOrFile: sourcePath,
      subpath,
      targetPathOrFile: fileOrOptions
    });
  } else {
    options = fileOrOptions;
  }
  return generateMarkdownLinkFull({ app: plugin.app, ...options });
}

function getDefaultOptions(plugin: BetterMarkdownLinksPlugin): Partial<GenerateMarkdownLinkFullOptions> {
  return normalizeOptionalProperties<Partial<GenerateMarkdownLinkFullOptions>>({
    isEmptyEmbedAliasAllowed: plugin.settings.allowEmptyEmbedAlias,
    isWikilink: plugin.settings.ignoreIncompatibleObsidianSettings ? false : undefined,
    shouldForceRelativePath: plugin.settings.ignoreIncompatibleObsidianSettings ? true : undefined,
    shouldIncludeAttachmentExtensionToEmbedAlias: plugin.settings.includeAttachmentExtensionToEmbedAlias,
    shouldUseAngleBrackets: plugin.settings.useAngleBrackets,
    shouldUseLeadingDot: plugin.settings.useLeadingDot
  });
}
