import { LinkStyle } from 'obsidian-dev-utils/obsidian/Link';
import { PathSettings } from 'obsidian-dev-utils/obsidian/Plugin/PathSettings';

export class PluginSettings {
  public shouldAllowEmptyEmbedAlias = true;
  public shouldAutomaticallyConvertNewLinks = true;
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
}
