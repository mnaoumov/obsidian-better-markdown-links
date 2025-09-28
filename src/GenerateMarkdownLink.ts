import type { FileManager } from 'obsidian';
import type {
  GenerateMarkdownLinkDefaultOptionsWrapper,
  GenerateMarkdownLinkOptions as GenerateMarkdownLinkFullOptions
} from 'obsidian-dev-utils/obsidian/Link';
import type { Except } from 'type-fest';

import { TFile } from 'obsidian';
import { normalizeOptionalProperties } from 'obsidian-dev-utils/ObjectUtils';
import {
  generateMarkdownLink as generateMarkdownLinkFull,
  LinkPathStyle
} from 'obsidian-dev-utils/obsidian/Link';

import type { Plugin } from './Plugin.ts';

export type GenerateMarkdownLinkFn = FileManager['generateMarkdownLink'];

type GenerateMarkdownLinkForPluginOptions = Except<GenerateMarkdownLinkFullOptions, 'app'>;

export function getPatchedGenerateMarkdownLink(plugin: Plugin): GenerateMarkdownLinkDefaultOptionsWrapper & GenerateMarkdownLinkFn {
  function generateMarkdownLinkFn(fileOrOptions: GenerateMarkdownLinkForPluginOptions | TFile, sourcePath: string, subpath?: string, alias?: string): string {
    return generateMarkdownLinkForPlugin(plugin, fileOrOptions, sourcePath, subpath, alias);
  }

  const generateMarkdownLinkDefaultOptionsWrapper: GenerateMarkdownLinkDefaultOptionsWrapper = {
    defaultOptionsFn: () => getDefaultOptions(plugin)
  };
  return Object.assign(generateMarkdownLinkFn, generateMarkdownLinkDefaultOptionsWrapper) as GenerateMarkdownLinkDefaultOptionsWrapper & GenerateMarkdownLinkFn;
}

function generateMarkdownLinkForPlugin(
  plugin: Plugin,
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

function getDefaultOptions(plugin: Plugin): Partial<GenerateMarkdownLinkFullOptions> {
  return normalizeOptionalProperties<Partial<GenerateMarkdownLinkFullOptions>>({
    isEmptyEmbedAliasAllowed: plugin.settings.shouldAllowEmptyEmbedAlias,
    linkPathStyle: plugin.settings.shouldIgnoreIncompatibleObsidianSettings ? LinkPathStyle.RelativePathToTheNote : undefined,
    linkStyle: plugin.settings.getLinkStyle(false),
    shouldIncludeAttachmentExtensionToEmbedAlias: plugin.settings.shouldIncludeAttachmentExtensionToEmbedAlias,
    shouldUseAngleBrackets: plugin.settings.shouldUseAngleBrackets,
    shouldUseLeadingDotForRelativePaths: plugin.settings.shouldUseLeadingDot
  });
}
