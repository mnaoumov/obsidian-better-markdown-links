# Demote embeds

An embed and a link differ by a single `!`: `![note](<note.md>)` renders the whole note inline, `[note](<note.md>)` is just a link to it. That one character is easy to add by accident — dragging a file in, or picking the wrong autocomplete entry — and tedious to remove across a vault by hand.

Demoting turns every embed in a note back into a plain link. The target, the alias and the link style are all left as they were; only the `!` goes.

The one exception is an embed with an **empty** alias pointing at a note. `![](<Some note.md>)` needs no text — it renders the note inline — but `[](<Some note.md>)` would render as nothing at all, so the target's name is filled in: `[Some note](<Some note.md>)`. An embed of an attachment keeps its empty alias, since **Should allow empty embed alias** governs that case.

## On demand

Three commands are available in the Command Palette:

- **Better Markdown Links: Demote embeds to links in current file**
  - demotes every embed in the active note.
- **Better Markdown Links: Demote embeds to links in current folder**
  - demotes every embed in a folder (also available by right-clicking a folder in the File Explorer).
- **Better Markdown Links: Demote embeds to links in entire vault**
  - demotes the whole vault at once.

The button below writes a note whose every link is an embed — a plain one, one carrying an alias, and a wikilink embed — and opens it:

```code-button
---
caption: Create a note full of embeds
---
await require('/demoSetup.ts').openEmbeddedNote(app);
```

Manual equivalent: create a note and write some `![...]` embeds in it.

```code-button
---
caption: Demote embeds in the current file
---
require('/demoSetup.ts').demoteEmbedsInCurrentFile(app);
```

Manual equivalent: run **Better Markdown Links: Demote embeds to links in current file** from the Command Palette.

Each `!` disappears and nothing else moves. Press the first button again to get the embeds back and try the setting below.

## Keeping the file name visible

An embed shows you what it points at; a link only shows its alias, and a plain embed has no alias at all. Demoting a wall of embeds can therefore leave you with a list of links you can no longer tell apart.

**Should append file name when demoting embeds** (`shouldAppendFileNameWhenDemotingEmbeds`) puts the target's file name back, as a sub-bullet under each demoted link:

```markdown
![](<Materials/Diagram.png>)

becomes

[](<Materials/Diagram.png>)
  - Diagram.png
```

```code-button
---
caption: Append the file name as a sub-bullet
---
await require('/demoSetup.ts').changeSettings(app, { shouldAppendFileNameWhenDemotingEmbeds: true });
```

```code-button
---
caption: Back to the default (no sub-bullet)
---
await require('/demoSetup.ts').changeSettings(app, { shouldAppendFileNameWhenDemotingEmbeds: false });
```

Manual equivalent: toggle **Should append file name when demoting embeds** in **Settings -> Community plugins -> Better Markdown Links**.

Reset the embeds note and demote again after switching to compare the two.

## Scope

Demoting honours the same **Include paths** / **Exclude paths** settings as conversion does, so Excalidraw and tldraw notes are skipped by default. Running the command on a single excluded note asks first, rather than silently doing nothing. See [05 Settings](<./05 Settings.md>).
