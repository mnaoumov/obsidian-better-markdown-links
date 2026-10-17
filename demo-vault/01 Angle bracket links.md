# Angle bracket links

Markdown links are more portable than `[[wikilinks]]`, but when a path contains spaces Obsidian normally percent-encodes them, producing links that are hard to read:

```markdown
[Note with spaces](A%20folder%20with%20spaces/Note%20with%20spaces.md)
```

The Markdown spec allows a far more readable form using **angle brackets**, which Obsidian understands but does not generate on its own:

```markdown
[Note with spaces](<Materials/01 Angle bracket links/A folder with spaces/Note with spaces.md>)
```

With **Should use angle brackets** enabled (the default), `Better Markdown Links` makes Obsidian generate the angle-bracket form whenever a link is created or converted.

## Try it

1. Open [03 Convert links](<./03 Convert links.md>) to see the commands that rewrite existing links.
2. Or type a fresh link to [Note with spaces](<Materials/01 Angle bracket links/A folder with spaces/Note with spaces.md>) - a target whose folder and file name both contain spaces - and watch how it is formatted.
3. Compare it with a link to [Simple note](<Materials/02 Relative links/Targets/Simple note.md>), where only the file name contains a space. One space is enough to make the difference worth having: the percent-encoded form of that same link is `Simple%20note.md`, and it gets worse with every space in the path.

The link above already uses the angle-bracket form, so it stays readable while still resolving to the real note.

A fresh link is a Markdown link only when something asks for one. This vault follows Obsidian's own **Use `[[Wikilinks]]`** setting, which is on by default, and a wikilink has no angle brackets to show. So each button below first sets **Link style** to **Markdown**. It then writes a note holding a fresh link to both targets, generated exactly the way Obsidian generates the link you type, and opens it:

```code-button
---
caption: Write fresh links with angle brackets
---
await require('/demoSetup.ts').writeAngleBracketLinks(app, true);
```

```code-button
---
caption: Write them percent-encoded instead
---
await require('/demoSetup.ts').writeAngleBracketLinks(app, false);
```

Manual equivalent: set **Link style** to **Markdown** and toggle **Should use angle brackets** in **Settings -> Community plugins -> Better Markdown Links**, then type a link with `[[` in any note.

```code-button
---
caption: Back to the defaults
---
await require('/demoSetup.ts').changeSettings(app, { linkStyleMode: 'ObsidianSettingsDefault', shouldUseAngleBrackets: true });
```

Manual equivalent: set **Link style** back to **Obsidian settings default** and turn **Should use angle brackets** back on.
