import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';
import type { MaybeReturn } from 'obsidian-dev-utils/type';

import { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';
import { isValidRegExp } from 'obsidian-dev-utils/reg-exp';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { PluginSettings } from './plugin-settings.ts';

interface PluginSettingsComponentConstructorParams {
  readonly dataHandler: DataHandler;
  readonly pluginEventSource: PluginEventSource;
}

class LegacySettings {
  public allowEmptyEmbedAlias = true;
  public automaticallyConvertNewLinks = true;
  public automaticallyUpdateLinksOnRenameOrMove = true;
  public includeAttachmentExtensionToEmbedAlias = false;
  public shouldAutomaticallyConvertNewLinks = true;

  // Owned by Advanced Rename and Delete Handler since 5.0.0. The converter is what keeps the user's value:
  // The saved record is rebuilt from the declared properties alone, so the first save after the property was
  // Dropped would otherwise strip it from `data.json` before it could ever be offered.
  public shouldAutomaticallyUpdateLinksOnRenameOrMove = true;

  public shouldUseLeadingDot = true;
  public useAngleBrackets = true;
  public useLeadingDot = true;
}

export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  public constructor(params: PluginSettingsComponentConstructorParams) {
    super({
      ...params,
      pluginSettingsClass: PluginSettings
    });
  }

  protected override registerLegacySettingsConverters(): void {
    this.registerLegacySettingsConverter(LegacySettings, (legacySettings) => {
      if (legacySettings.allowEmptyEmbedAlias !== undefined) {
        legacySettings.shouldAllowEmptyEmbedAlias = legacySettings.allowEmptyEmbedAlias;
      }

      if (legacySettings.automaticallyConvertNewLinks !== undefined) {
        legacySettings.shouldAutomaticallyConvertNewLinks = legacySettings.automaticallyConvertNewLinks;
      }

      if (legacySettings.shouldAutomaticallyConvertNewLinks !== undefined) {
        legacySettings.linkConversionMode = legacySettings.shouldAutomaticallyConvertNewLinks
          ? LinkConversionMode.OnEveryModification
          : LinkConversionMode.OnExplicitCommand;
      }

      if (legacySettings.automaticallyUpdateLinksOnRenameOrMove !== undefined) {
        legacySettings.shouldAutomaticallyUpdateLinksOnRenameOrMove = legacySettings.automaticallyUpdateLinksOnRenameOrMove;
      }

      // The end of that chain is no longer a setting of this plugin's — it is parked for Advanced Rename and
      // Delete Handler to be offered. Runs after the block above, so a vault still on the oldest key name
      // Reaches here with its value already carried forward.
      if (legacySettings.shouldAutomaticallyUpdateLinksOnRenameOrMove !== undefined) {
        legacySettings.proposedShouldHandleRenames = legacySettings.shouldAutomaticallyUpdateLinksOnRenameOrMove;
      }

      if (legacySettings.includeAttachmentExtensionToEmbedAlias !== undefined) {
        legacySettings.shouldIncludeAttachmentExtensionToEmbedAlias = legacySettings.includeAttachmentExtensionToEmbedAlias;
      }

      if (legacySettings.useAngleBrackets !== undefined) {
        legacySettings.shouldUseAngleBrackets = legacySettings.useAngleBrackets;
      }

      if (legacySettings.useLeadingDot !== undefined) {
        legacySettings.shouldUseLeadingDotForRelativePaths = legacySettings.useLeadingDot;
      }

      if (legacySettings.shouldUseLeadingDot !== undefined) {
        legacySettings.shouldUseLeadingDotForRelativePaths = legacySettings.shouldUseLeadingDot;
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
    if (!(path.startsWith('/') && path.endsWith('/'))) {
      continue;
    }

    const regExp = path.slice(1, -1);
    if (!isValidRegExp(regExp)) {
      return `Invalid regular expression ${path}`;
    }
  }
}
