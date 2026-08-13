# Start here

Welcome to the [Better Markdown Links](https://github.com/mnaoumov/obsidian-better-markdown-links/) demo vault. This plugin makes Obsidian generate cleaner, more portable Markdown links: it wraps paths with spaces in **angle brackets**, makes relative links explicit with a leading `./`, normalizes external `file://` links, and can convert existing links in a note, a folder, or the whole vault.

## Your first two minutes

1. Open [01 Angle bracket links](<./01 Angle bracket links.md>) and look at the link to
   **Note with spaces**. It reads `[Note with spaces](<A folder with spaces/Note with spaces.md>)` —
   readable, because the path is wrapped in angle brackets rather than littered with `%20`.
2. In any note, type `[[` and pick a note whose path has spaces. Obsidian would normally write the
   percent-encoded form; with this plugin you get the angle-bracket one.
3. Run **Better Markdown Links: Convert links in current file** from the Command Palette on a note
   holding older links, and watch them tidy up in place.

No setup is needed: the notes and folders these steps use ship in `Materials/`, and the formatting
settings are documented in [04 Settings](<./04 Settings.md>).

## Explore

- [01 Angle bracket links](<./01 Angle bracket links.md>)
- [02 Relative links](<./02 Relative links.md>)
- [03 Convert links](<./03 Convert links.md>)
- [04 Settings](<./04 Settings.md>)

## Materials

`Materials/` holds the notes the walkthroughs link to, one folder per note that needs them —
`Materials/01 Angle bracket links/A folder with spaces/` is the deliberately awkward path that makes
angle brackets worth having. You never have to open it directly; each note links to what it needs.
