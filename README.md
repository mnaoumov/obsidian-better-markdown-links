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

## Installation

- `Better Markdown Links` is not available in [the official Community Plugins repository](https://obsidian.md/plugins) yet.
- Beta releases can be installed through [BRAT](https://github.com/TfTHacker/obsidian42-brat).

## License

© [Michael Naumov](https://github.com/mnaoumov/)

[Obsidian]: https://obsidian.md/
