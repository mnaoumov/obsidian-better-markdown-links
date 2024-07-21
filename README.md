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

## Extend [`app.fileManager.generateMarkdownLink()`][generateMarkdownLink]

This plugin enhances the [`app.fileManager.generateMarkdownLink()`][generateMarkdownLink] function by adding two optional parameters: `isEmbed` and `isWikilink`. The extended function signature is as follows:

```typescript
/**
 * Generate a markdown link based on the user's preferences.
 * @param file - the file to link to.
 * @param sourcePath - where the link is stored in, used to compute relative links.
 * @param subpath - A subpath, starting with `#`, used for linking to headings or blocks.
 * @param alias - The display text if it's to be different than the file name. Pass empty string to use file name.
 * @param isEmbed - A boolean indicating if the link should be embedded. If omitted or `undefined`, the function behaves as its original version.
 * @param isWikilink - A boolean indicating if the link should be in wiki-link format. If omitted or `undefined`, the function behaves as its original version.
 */
generateMarkdownLink(file: TFile, sourcePath: string, subpath?: string, alias?: string, isEmbed?: boolean, isWikilink?: boolean): string
```

**Note**: The plugin's setting `Ignore incompatible Obsidian settings` sets the default value of `isWikilink` to `false`.

## Installation

- `Better Markdown Links` is available in [the official Community Plugins repository](https://obsidian.md/plugins).
- Beta releases can be installed through [BRAT](https://github.com/TfTHacker/obsidian42-brat).

## License

© [Michael Naumov](https://github.com/mnaoumov/)

[Obsidian]: https://obsidian.md/

[generateMarkdownLink]: https://github.com/obsidianmd/obsidian-api/blob/ea526e2459ad3f188c994862a9b106d94bf0f692/obsidian.d.ts#L1435
