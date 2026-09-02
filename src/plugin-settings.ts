import { LinkStyle } from 'obsidian-dev-utils/obsidian/link';
import { PathSettings } from 'obsidian-dev-utils/obsidian/path-settings';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { LinkStyleMode } from './link-style-mode.ts';

export class PluginSettings {
  public isAdvancedRenameAndDeleteHandlerSuggestionDeclined = false;
  public linkConversionMode: LinkConversionMode = LinkConversionMode.OnSaveCommand;
  public linkStyleMode: LinkStyleMode = LinkStyleMode.ObsidianSettingsDefault;

  // The legacy `shouldAutomaticallyUpdateLinksOnRenameOrMove` value, waiting to be offered to Advanced Rename
  // And Delete Handler. Non-`null` means an offer is still pending; `null` means there is nothing to offer,
  // Which is also what a fresh install has. One property rather than a flag plus a value, so a fresh install
  // Can never be told it has a migration waiting.
  public proposedShouldHandleRenames: boolean | null = null;

  public shouldAllowEmptyEmbedAlias = true;
  public shouldAppendFileNameWhenDemotingEmbeds = false;
  public shouldCreateMissingNotes = false;
  public shouldIncludeAttachmentExtensionToEmbedAlias = false;
  public shouldNormalizeFileLinks = true;
  public shouldResolveLinksViaAliases = false;
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
    this.excludePaths = [String.raw`/.+\.excalidraw\.md$/`, String.raw`/.+\.tldraw\.md$/`];
  }

  /**
   * The style to force on a link this plugin GENERATES — a brand new one, or the plain link an embed is
   * demoted to. `undefined` leaves `obsidian-dev-utils`' own inference in place, which resolves an absent
   * style to `PreserveExisting`: for a link with no original that means Obsidian's `Use [[Wikilinks]]`
   * setting, and for a rewritten one it means the style the link already had.
   *
   * Only {@link LinkStyleMode.Markdown} has anything to say here. The other two modes ARE that inference, so
   * returning a style for them would be worse than returning nothing: it would beat the `originalLink`
   * inference `EmbedDemoter` relies on to keep an embed's existing style.
   *
   * @returns The style to force, or `undefined` to leave the inference alone.
   */
  public getGeneratedLinkStyle(): LinkStyle | undefined {
    return this.linkStyleMode === LinkStyleMode.Markdown ? LinkStyle.Markdown : undefined;
  }

  /**
   * The style to write when an EXISTING link is converted.
   *
   * @returns The style.
   */
  public getLinkStyle(): LinkStyle {
    if (this.linkStyleMode === LinkStyleMode.Markdown) {
      return LinkStyle.Markdown;
    }

    if (this.linkStyleMode === LinkStyleMode.PreserveExisting) {
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
