# Convert links

Beyond formatting new links, Better Markdown Links can rewrite links that already exist so they match the configured style (angle brackets, leading dots, normalized `file://` links, and so on).

## On demand

Three commands are available in the Command Palette:

- **Better Markdown Links: Convert links in current file**
  - rewrites links in the active note.
- **Better Markdown Links: Convert links in current folder**
  - rewrites every note in a folder (also available by right-clicking a folder in the File Explorer).
- **Better Markdown Links: Convert links in entire vault**
  - rewrites the whole vault at once.

Knowing what a messy link looks like before you have seen one converted is the awkward part, so the button writes a note full of them - percent-encoded spaces, no leading dot, a backslash-and-percent `file://` URL - and opens it:

```code-button
---
caption: Create a note full of unconverted links
---
await require('/demoSetup.ts').openMessyNote(app);
```

Manual equivalent: create a note and paste in some percent-encoded, dot-less markdown links.

```code-button
---
caption: Convert links in the current file
---
require('/demoSetup.ts').convertLinksInCurrentFile(app);
```

Manual equivalent: run **Better Markdown Links: Convert links in current file** from the Command Palette.

Each link snaps into the readable form shown in [01 Angle bracket links](<./01 Angle bracket links.md>) and [02 Relative links](<./02 Relative links.md>). Press the first button again to get the messy note back and try a different setting.

## Automatically

The **Convert links** setting (`linkConversionMode`) controls whether conversion also happens without a command. Each option is cumulative - it includes every option above it:

- **On explicit command**
  - only when a convert command is invoked.
- **On save command**
  - additionally when the `Save current file` command runs (usually `Ctrl + S`).
- **On auto save**
  - additionally on Obsidian's implicit auto-save.
- **On every modification**
  - additionally on every change, including edits made outside Obsidian.

Each mode has a button, so you can watch the difference rather than infer it. After switching, reset the messy note and edit it to see when conversion fires:

```code-button
---
caption: Convert only on an explicit command
---
await require('/demoSetup.ts').changeSettings(app, { linkConversionMode: 'OnExplicitCommand' });
```

```code-button
---
caption: Convert on every modification
---
await require('/demoSetup.ts').changeSettings(app, { linkConversionMode: 'OnEveryModification' });
```

```code-button
---
caption: Back to the default (on save command)
---
await require('/demoSetup.ts').changeSettings(app, { linkConversionMode: 'OnSaveCommand' });
```

Manual equivalent: pick from the **Convert links** dropdown in **Settings -> Community plugins -> Better Markdown Links**.

## File link normalization

With **Should normalize file links** enabled (the default), external `file://` links are tidied up during conversion - backslashes become forward slashes and percent-encoding is decoded:

```markdown
[note](file:///C:%5Cnotes%5Ctodo.md)   ->   [note](file:///C:/notes/todo.md)
```

See [04 Settings](<./04 Settings.md>) for every option that shapes the conversion.
