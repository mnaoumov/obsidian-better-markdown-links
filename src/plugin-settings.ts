import {
  LinkPathStyle,
  LinkStyle
} from 'obsidian-dev-utils/obsidian/link';
import { PathSettings } from 'obsidian-dev-utils/obsidian/path-settings';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { LinkPathStyleMode } from './link-path-style-mode.ts';
import { LinkStyleMode } from './link-style-mode.ts';

// The two enums mirror each other value for value, so the mapping is a lookup rather than a conversion.
// Written out rather than cast, so adding a mode without deciding what it writes fails to compile.
const LINK_PATH_STYLE_BY_MODE: Record<LinkPathStyleMode, LinkPathStyle> = {
  [LinkPathStyleMode.AbsolutePathInVault]: LinkPathStyle.AbsolutePathInVault,
  [LinkPathStyleMode.ObsidianSettingsDefault]: LinkPathStyle.ObsidianSettingsDefault,
  [LinkPathStyleMode.RelativePathToTheSource]: LinkPathStyle.RelativePathToTheSource,
  [LinkPathStyleMode.ShortestPathWhenPossible]: LinkPathStyle.ShortestPathWhenPossible
};

/**
 * The path-related params to hand `obsidian-dev-utils` for one link, built by
 * {@link PluginSettings.buildLinkPathStyleParams}.
 */
export interface LinkPathStyleParams {
  /**
   * The path style to write.
   */
  readonly linkPathStyle: LinkPathStyle;

  /**
   * Absent unless the plugin is naming the path style itself. See
   * {@link PluginSettings.buildLinkPathStyleParams}.
   */
  readonly shouldUseLeadingDotForRelativePaths?: boolean;

  /**
   * Absent unless the plugin is naming the path style itself. See
   * {@link PluginSettings.buildLinkPathStyleParams}.
   */
  readonly shouldUseLeadingSlashForAbsolutePaths?: boolean;
}

export class PluginSettings {
  public isAdvancedRenameAndDeleteHandlerSuggestionDeclined = false;
  public linkConversionMode: LinkConversionMode = LinkConversionMode.OnSaveCommand;
  public linkPathStyleMode: LinkPathStyleMode = LinkPathStyleMode.ObsidianSettingsDefault;
  public linkStyleMode: LinkStyleMode = LinkStyleMode.ObsidianSettingsDefault;

  // The legacy `shouldAutomaticallyUpdateLinksOnRenameOrMove` value, waiting to be offered to Advanced Rename
  // and Delete Handler. Non-`null` means an offer is still pending; `null` means there is nothing to offer,
  // which is also what a fresh install has. One property rather than a flag plus a value, so a fresh install
  // can never be told it has a migration waiting.
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
   * The path-related params to state for one link whose final path style is `linkPathStyle`.
   *
   * Under {@link LinkPathStyleMode.ObsidianSettingsDefault} only the style itself is stated, leaving
   * `obsidian-dev-utils` to infer the leading dot and slash from the link being replaced
   * (`hasLeadingDot` / `hasLeadingSlash` over `originalLink`) exactly as it does today.
   *
   * Under any other mode both decorations are stated out loud, because the original link's own dot and
   * slash are evidence about a path style it no longer has: forcing a relative path onto an absolute link
   * that resolves to a sibling note would otherwise write `[[note.md]]` rather than `[[./note.md]]` —
   * losing the leading dot precisely where it was asked for.
   *
   * @param linkPathStyle - The final path style, from {@link getLinkPathStyle} or forced for one run.
   * @returns The params to spread into the `obsidian-dev-utils` call.
   */
  public buildLinkPathStyleParams(linkPathStyle: LinkPathStyle): LinkPathStyleParams {
    return linkPathStyle === LinkPathStyle.ObsidianSettingsDefault
      ? { linkPathStyle }
      : {
        linkPathStyle,
        shouldUseLeadingDotForRelativePaths: this.shouldUseLeadingDotForRelativePaths,
        shouldUseLeadingSlashForAbsolutePaths: this.shouldUseLeadingSlashForAbsolutePaths
      };
  }

  /**
   * The path style to force on a link this plugin GENERATES. `undefined` in the
   * {@link LinkPathStyleMode.ObsidianSettingsDefault} mode, which is the same answer
   * `obsidian-dev-utils` reaches for an absent value.
   *
   * The reason to return nothing rather than to say `ObsidianSettingsDefault` out loud is NOT the
   * `originalLink` inference {@link getGeneratedLinkStyle} protects — there is none for the path style.
   * It is the merge: these params are merged with `Object.assign`, so a key left in place would clobber a
   * path style another plugin's default-params function had set, instead of standing aside for it.
   *
   * @returns The style to force, or `undefined` to leave the default alone.
   */
  public getGeneratedLinkPathStyle(): LinkPathStyle | undefined {
    return this.linkPathStyleMode === LinkPathStyleMode.ObsidianSettingsDefault ? undefined : this.getLinkPathStyle();
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
   * The path style to write when an EXISTING link is converted.
   *
   * @returns The style.
   */
  public getLinkPathStyle(): LinkPathStyle {
    return LINK_PATH_STYLE_BY_MODE[this.linkPathStyleMode];
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

    return this.linkStyleMode === LinkStyleMode.PreserveExisting ? LinkStyle.PreserveExisting : LinkStyle.ObsidianSettingsDefault;
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
