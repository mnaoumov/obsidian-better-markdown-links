import type { MaybeReturn } from 'obsidian-dev-utils/Type';

import { PluginSettingsManagerBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsManagerBase';
import { isValidRegExp } from 'obsidian-dev-utils/RegExp';

import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettings } from './PluginSettings.ts';

class LegacySettings {
  public allowEmptyEmbedAlias = true;
  public automaticallyConvertNewLinks = true;
  public automaticallyUpdateLinksOnRenameOrMove = true;
  public ignoreIncompatibleObsidianSettings = false;
  public includeAttachmentExtensionToEmbedAlias = false;
  public useAngleBrackets = true;
  public useLeadingDot = true;
}

export class PluginSettingsManager extends PluginSettingsManagerBase<PluginTypes> {
  protected override createDefaultSettings(): PluginSettings {
    return new PluginSettings();
  }

  protected override registerLegacySettingsConverters(): void {
    this.registerLegacySettingsConverter(LegacySettings, (legacySettings) => {
      if (legacySettings.allowEmptyEmbedAlias !== undefined) {
        legacySettings.shouldAllowEmptyEmbedAlias = legacySettings.allowEmptyEmbedAlias;
      }

      if (legacySettings.automaticallyConvertNewLinks !== undefined) {
        legacySettings.shouldAutomaticallyConvertNewLinks = legacySettings.automaticallyConvertNewLinks;
      }

      if (legacySettings.automaticallyUpdateLinksOnRenameOrMove !== undefined) {
        legacySettings.shouldAutomaticallyUpdateLinksOnRenameOrMove = legacySettings.automaticallyUpdateLinksOnRenameOrMove;
      }

      if (legacySettings.ignoreIncompatibleObsidianSettings !== undefined) {
        legacySettings.shouldIgnoreIncompatibleObsidianSettings = legacySettings.ignoreIncompatibleObsidianSettings;
      }

      if (legacySettings.includeAttachmentExtensionToEmbedAlias !== undefined) {
        legacySettings.shouldIncludeAttachmentExtensionToEmbedAlias = legacySettings.includeAttachmentExtensionToEmbedAlias;
      }

      if (legacySettings.useAngleBrackets !== undefined) {
        legacySettings.shouldUseAngleBrackets = legacySettings.useAngleBrackets;
      }

      if (legacySettings.useLeadingDot !== undefined) {
        legacySettings.shouldUseLeadingDot = legacySettings.useLeadingDot;
      }
    });
  }

  protected override registerValidators(): void {
    this.registerValidator('includePaths', pathsValidator);
    this.registerValidator('excludePaths', pathsValidator);
  }
}

function pathsValidator(paths: string[]): MaybeReturn<string> {
  for (const path of paths) {
    if (path.startsWith('/') && path.endsWith('/')) {
      const regExp = path.slice(1, -1);
      if (!isValidRegExp(regExp)) {
        return `Invalid regular expression ${path}`;
      }
    }
  }
}
