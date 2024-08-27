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

This plugin enhances the [`app.fileManager.generateMarkdownLink()`][generateMarkdownLink] function by adding an additional overload:

```typescript
/**
 * Generates a markdown link based on the provided parameters.
 *
 * @param options - The options for generating the markdown link.
 * @returns The generated markdown link.
 */
generateMarkdownLink(options: GenerateMarkdownLinkOptions): string

/**
 * Options for generating a markdown link.
 */
export type GenerateMarkdownLinkOptions = {
    /**
     * The file to link to.
     */
    pathOrFile: PathOrFile;

    /**
     * The source path of the link.
     */
    sourcePathOrFile: PathOrFile;

    /**
     * The subpath of the link.
     */
    subpath?: string | undefined;

    /**
     * The alias for the link.
     */
    alias?: string | undefined;

    /**
     * Indicates if the link should be embedded. If not provided, it will be inferred based on the file type.
     */
    isEmbed?: boolean | undefined;

    /**
     * Indicates if the link should be a wikilink. If not provided, it will be inferred based on the Obsidian settings.
     */
    isWikilink?: boolean | undefined;

    /**
     * Indicates if the link should be relative. If not provided or `false`, it will be inferred based on the Obsidian settings.
     */
    forceRelativePath?: boolean | undefined;

    /**
     * Indicates if the link should use a leading dot. Defaults to `false`. Has no effect if `isWikilink` is `true` or `isRelative` is `false`.
     */
    useLeadingDot?: boolean | undefined;

    /**
     * Indicates if the link should use angle brackets. Defaults to `false`. Has no effect if `isWikilink` is `true`
     */
    useAngleBrackets?: boolean | undefined;
};
```

**Note**: The plugin's setting `Ignore incompatible Obsidian settings` sets the default value of `isWikilink` to `false`.

## Installation

- `Better Markdown Links` is available in [the official Community Plugins repository](https://obsidian.md/plugins?id=better-markdown-links).
- Beta releases can be installed through [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).

## License

© [Michael Naumov](https://github.com/mnaoumov/)

[Obsidian]: https://obsidian.md/

[generateMarkdownLink]: https://github.com/obsidianmd/obsidian-api/blob/ea526e2459ad3f188c994862a9b106d94bf0f692/obsidian.d.ts#L1435
