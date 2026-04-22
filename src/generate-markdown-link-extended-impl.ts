import type { FileManager } from 'obsidian';
import type { ReadonlyDeep } from 'type-fest';

import { TFile } from 'obsidian';
import {
  normalizeOptionalProperties,
  removeUndefinedProperties
} from 'obsidian-dev-utils/object-utils';
import {
  generateMarkdownLink,
  registerGenerateMarkdownLinkDefaultOptionsFn
} from 'obsidian-dev-utils/obsidian/link';
import { registerPatch } from 'obsidian-dev-utils/obsidian/monkey-around';

import type {
  GenerateMarkdownLinkExtendedOptions,
  GenerateMarkdownLinkExtendedWrapper
} from './generate-markdown-link-extended.d.ts';
import type { Plugin } from './plugin.ts';
import type { PluginSettings } from './plugin-settings.ts';

export type GenerateMarkdownLinkNativeFn = FileManager['generateMarkdownLink'];

export function patchGenerateMarkdownLink(plugin: Plugin, getSettings: () => ReadonlyDeep<PluginSettings>): void {
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

  registerGenerateMarkdownLinkDefaultOptionsFn(plugin, () => {
    const settings = getSettings();
    return {
      isEmptyEmbedAliasAllowed: settings.shouldAllowEmptyEmbedAlias,
      shouldIncludeAttachmentExtensionToEmbedAlias: settings.shouldIncludeAttachmentExtensionToEmbedAlias,
      shouldUseAngleBrackets: settings.shouldUseAngleBrackets,
      shouldUseLeadingDotForRelativePaths: settings.shouldUseLeadingDotForRelativePaths,
      shouldUseLeadingSlashForAbsolutePaths: settings.shouldUseLeadingSlashForAbsolutePaths
    };
  });
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
