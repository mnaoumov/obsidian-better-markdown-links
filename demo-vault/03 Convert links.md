[Docs](https://github.com/mnaoumov/obsidian-better-markdown-links/)

# Convert links

Beyond formatting new links, Better Markdown Links can rewrite links that already exist so they
match the configured style (angle brackets, leading dots, normalized `file://` links, and so on).

## On demand

Three commands are available in the Command Palette:

- **Better Markdown Links: Convert links in current file** - rewrites links in the active note.
- **Better Markdown Links: Convert links in current folder** - rewrites every note in a folder
  (also available by right-clicking a folder in the File Explorer).
- **Better Markdown Links: Convert links in entire vault** - rewrites the whole vault at once.

Try it: open [Simple note](<Targets/Simple note.md>), add a messy link by hand, then run
**Convert links in current file** and watch it snap into the readable form shown in
[[01 Angle bracket links]] and [[02 Relative links]].

## Automatically

The **Convert links** setting (`linkConversionMode`) controls whether conversion also happens
without a command. Each option is cumulative - it includes every option above it:

- **On explicit command** - only when a convert command is invoked.
- **On save command** - additionally when the `Save current file` command runs (usually `Ctrl + S`).
- **On auto save** - additionally on Obsidian's implicit auto-save.
- **On every modification** - additionally on every change, including edits made outside Obsidian.

## File link normalization

With **Should normalize file links** enabled (the default), external `file://` links are tidied
up during conversion - backslashes become forward slashes and percent-encoding is decoded:

```markdown
[note](file:///C:%5Cnotes%5Ctodo.md)   ->   [note](file:///C:/notes/todo.md)
```

See [[04 Settings]] for every option that shapes the conversion.
