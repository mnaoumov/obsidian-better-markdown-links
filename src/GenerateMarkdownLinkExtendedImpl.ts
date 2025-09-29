import type { FileManager } from 'obsidian';

import { TFile } from 'obsidian';
import {
  normalizeOptionalProperties,
  removeUndefinedProperties
} from 'obsidian-dev-utils/ObjectUtils';
import {
  generateMarkdownLink,
  registerGenerateMarkdownLinkDefaultOptionsFn
} from 'obsidian-dev-utils/obsidian/Link';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';

import type {
  GenerateMarkdownLinkExtendedOptions,
  GenerateMarkdownLinkExtendedWrapper
} from './GenerateMarkdownLinkExtended.d.ts';
import type { Plugin } from './Plugin.ts';

export type GenerateMarkdownLinkNativeFn = FileManager['generateMarkdownLink'];

export function patchGenerateMarkdownLink(plugin: Plugin): void {
  registerPatch(plugin, plugin.app.fileManager, {
    generateMarkdownLink(): GenerateMarkdownLinkExtendedWrapper & GenerateMarkdownLinkNativeFn {
      return Object.assign(native, { extended });

      function native(file: TFile, sourcePath: string, subpath?: string, alias?: string): string {
        return generateMarkdownLinkNative(plugin, file, sourcePath, subpath, alias);
      }

      function extended(options: GenerateMarkdownLinkExtendedOptions): string {
        return generateMarkdownLinkExtended(plugin, options);
      }
    }
  });

  registerGenerateMarkdownLinkDefaultOptionsFn(plugin, () => ({
    isEmptyEmbedAliasAllowed: plugin.settings.shouldAllowEmptyEmbedAlias,
    shouldIncludeAttachmentExtensionToEmbedAlias: plugin.settings.shouldIncludeAttachmentExtensionToEmbedAlias,
    shouldUseAngleBrackets: plugin.settings.shouldUseAngleBrackets,
    shouldUseLeadingDotForRelativePaths: plugin.settings.shouldUseLeadingDotForRelativePaths,
    shouldUseLeadingSlashForAbsolutePaths: plugin.settings.shouldUseLeadingSlashForAbsolutePaths
  }));
}

function generateMarkdownLinkExtended(plugin: Plugin, options: GenerateMarkdownLinkExtendedOptions): string {
  return generateMarkdownLink({
    app: plugin.app,
    ...options
  });
}

function generateMarkdownLinkNative(plugin: Plugin, file: TFile, sourcePath: string, subpath?: string, alias?: string): string {
  return generateMarkdownLinkExtended(
    plugin,
    removeUndefinedProperties(normalizeOptionalProperties<GenerateMarkdownLinkExtendedOptions>({
      alias,
      sourcePathOrFile: sourcePath,
      subpath,
      targetPathOrFile: file
    }))
  );
}
