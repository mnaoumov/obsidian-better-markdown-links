/**
 * Which link path style the plugin writes. Values mirror `LinkPathStyle` from `obsidian-dev-utils`, so the
 * mapping in {@link PluginSettings.getLinkPathStyle} is a straight lookup and the value stored in `data.json`
 * reads plainly.
 *
 * All four of the library's values are offered. Unlike `LinkStyle.Wikilink`, which
 * {@link LinkStyleMode} leaves out because a plugin named Better Markdown Links producing wikilinks on
 * purpose is not a mode worth shipping, none of these contradicts anything the plugin is for - and two of
 * them are what make `shouldUseLeadingDotForRelativePaths` and `shouldUseLeadingSlashForAbsolutePaths`
 * addressable at all, since `obsidian-dev-utils` applies each only under its matching style.
 *
 * There is no `PreserveExisting` here, because the library's `LinkPathStyle` has none: a link's path can be
 * rewritten or left to Obsidian's own `New link format` setting, and nothing infers a path style from the
 * link that is being replaced.
 */
export enum LinkPathStyleMode {
  /**
   * Always write the path from the vault root, whatever Obsidian's `New link format` setting says.
   */
  AbsolutePathInVault = 'AbsolutePathInVault',

  /**
   * Follow Obsidian's `New link format` setting.
   */
  ObsidianSettingsDefault = 'ObsidianSettingsDefault',

  /**
   * Always write the path relative to the note the link is in, whatever Obsidian's `New link format`
   * setting says.
   */
  RelativePathToTheSource = 'RelativePathToTheSource',

  /**
   * Always write the shortest path that still resolves to a single note, whatever Obsidian's
   * `New link format` setting says.
   */
  ShortestPathWhenPossible = 'ShortestPathWhenPossible'
}
