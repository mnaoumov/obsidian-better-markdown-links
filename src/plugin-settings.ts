import { LinkStyle } from 'obsidian-dev-utils/obsidian/link';
import { PathSettings } from 'obsidian-dev-utils/obsidian/path-settings';

import { LinkConversionMode } from './link-conversion-mode.ts';

export class PluginSettings {
  public linkConversionMode: LinkConversionMode = LinkConversionMode.OnSaveCommand;
  public shouldAllowEmptyEmbedAlias = true;
  public shouldAutomaticallyUpdateLinksOnRenameOrMove = true;
  public shouldIncludeAttachmentExtensionToEmbedAlias = false;
  public shouldPreserveExistingLinkStyle = false;
  public shouldUseAngleBrackets = true;
  public shouldUseLeadingDotForRelativePaths = true;
  public shouldUseLeadingSlashForAbsolutePaths = true;

  public get excludePaths(): string[] {
    return this._pathSettings.excludePaths;
  }

  public set excludePaths(value: string[]) {
    this._pathSettings.excludePaths = value;
  }

  public get includePaths(): string[] {
    return this._pathSettings.includePaths;
  }

  public set includePaths(value: string[]) {
    this._pathSettings.includePaths = value;
  }

  private readonly _pathSettings = new PathSettings();

  public constructor() {
    this.excludePaths = ['/.+\\.excalidraw\\.md$/', '/.+\\.tldraw\\.md$/'];
  }

  public getLinkStyle(isExistingLink: boolean): LinkStyle {
    if (isExistingLink && this.shouldPreserveExistingLinkStyle) {
      return LinkStyle.PreserveExisting;
    }

    return LinkStyle.ObsidianSettingsDefault;
  }

  public isPathIgnored(path: string): boolean {
    return this._pathSettings.isPathIgnored(path);
  }

  /**
   * Whether a modification of a file (via the vault `modify` event) should trigger conversion. Only the
   * most aggressive mode reacts to every modification, since that is the only trigger that also fires
   * for changes made outside Obsidian.
   */
  public shouldConvertLinksOnModify(): boolean {
    return this.linkConversionMode === LinkConversionMode.OnEveryModification;
  }

  /**
   * Whether navigating to a link (via `Workspace.openLinkText`) should trigger conversion of the source
   * file. Enabled whenever any automatic conversion is enabled.
   */
  public shouldConvertLinksOnNavigation(): boolean {
    return this.linkConversionMode !== LinkConversionMode.OnExplicitCommand;
  }

  /**
   * Whether saving the editor to disk should trigger conversion. `OnAutoSave` converts on any save;
   * `OnSaveCommand` converts only when the save was initiated by the `Save current file` command. The
   * `OnEveryModification` mode deliberately does not convert here — its vault `modify` handler already
   * reacts to the save's write, so converting here too would be redundant.
   *
   * @param isSaveCommand - Whether the save was initiated by the `Save current file` command.
   */
  public shouldConvertLinksOnSave(isSaveCommand: boolean): boolean {
    return this.linkConversionMode === LinkConversionMode.OnAutoSave
      || (this.linkConversionMode === LinkConversionMode.OnSaveCommand && isSaveCommand);
  }
}
