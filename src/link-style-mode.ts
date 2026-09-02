/**
 * Which link style the plugin writes. Values mirror `LinkStyle` from `obsidian-dev-utils`, so the mapping in
 * {@link PluginSettings.getLinkStyle} is a straight lookup and the value stored in `data.json` reads plainly.
 *
 * `Wikilink` is deliberately not offered: `obsidian-dev-utils` supports it, but a plugin named Better Markdown
 * Links producing wikilinks on purpose is not a mode worth shipping.
 */
export enum LinkStyleMode {
  /**
   * Always write markdown links, whatever Obsidian's `Use [[Wikilinks]]` setting says.
   */
  Markdown = 'Markdown',

  /**
   * Follow Obsidian's `Use [[Wikilinks]]` setting.
   */
  ObsidianSettingsDefault = 'ObsidianSettingsDefault',

  /**
   * Keep each link's existing wikilink-vs-markdown style.
   */
  PreserveExisting = 'PreserveExisting'
}
