# Better Markdown Links

This is a plugin for [Obsidian] that adds support for `angle bracket` links and manages relative links properly.

## Angle Bracket Links

Markdown links `[Title](path/to/note.md)` are better for compatibility purposes as `[[Wikilink]]` is not part of the Markdown spec.

However, links with spaces `[Title](path%20with%20space/note%20with%20space.md)` are quite unreadable.

The Markdown spec allows more readable links `[Title](<path with space/note with space.md>)`, which work fine in [Obsidian], but [Obsidian] doesn't generate such `angle bracket` links.

This plugin makes [Obsidian] generate `angle bracket` links.

## Relative Links

There is a [problem](https://forum.obsidian.md/t/add-settings-to-control-link-resolution-mode/69560) in [Obsidian] where relative paths might be incorrectly resolved as absolute paths, causing the same link to behave differently in [Obsidian] and other Markdown editors.

This plugin ensures that relative paths are prepended with `./`, e.g., `[Title](./path/to/note.md)`, to overcome the above-mentioned problem.

## Link Conversion

This plugin adds the ability to convert all links in an individual note or the entire vault.

## Automatic Link Conversion

This plugin adds the ability to automatically convert all new links entered manually to the selected format.

## Automatic handling rename/move

This plugin adds the ability to automatically update links to the renamed or moved to another directory files.

To improve performance, consider installing [Backlink Cache](https://obsidian.md/plugins?id=backlink-cache) plugin.

## Extend [`app.fileManager.generateMarkdownLink()`][generateMarkdownLink]

This plugin enhances the [`app.fileManager.generateMarkdownLink()`][generateMarkdownLink] function by adding an [additional overload](./types.d.ts).

If you want to use the updated functions from your plugin, you can copy [types.d.ts](./types.d.ts) into your code.

**Note**: The plugin's setting `Ignore incompatible Obsidian settings` sets the default value of `isWikilink` to `false`.

## Integration with other plugins

This plugin is handling rename/delete events based on the plugin settings. Similar handlers are added to other plugins:

- [`Consistent Attachments and Links`](https://obsidian.md/plugins?id=consistent-attachments-and-links)
- [`Custom Attachment Location`](https://obsidian.md/plugins?id=obsidian-custom-attachment-location)

But those handlers are designed to work fine with each other and the plugins can be installed together.

## Installation

- `Better Markdown Links` is available in [the official Community Plugins repository](https://obsidian.md/plugins?id=better-markdown-links).
- Beta releases can be installed through [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).

## Debugging

By default, debug messages for this plugin are hidden.

To show them, run the following command:

```js
window.DEBUG.enable('better-markdown-links');
```

For more details, refer to the [documentation](https://github.com/mnaoumov/obsidian-dev-utils?tab=readme-ov-file#debugging).

## License

© [Michael Naumov](https://github.com/mnaoumov/)

[Obsidian]: https://obsidian.md/
[generateMarkdownLink]: https://docs.obsidian.md/Reference/TypeScript+API/FileManager/generateMarkdownLink
