# Convert links

Beyond formatting new links, Better Markdown Links can rewrite links that already exist so they match the configured style (angle brackets, leading dots, normalized `file://` links, and so on).

## On demand

Three style-agnostic commands are available in the Command Palette (three more force the Markdown style - see [Forcing Markdown links](#forcing-markdown-links) below):

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

## Forcing Markdown links

Everything above rewrites a link's *path* while leaving its *style* to Obsidian. With Obsidian's own **Use `[[Wikilinks]]`** setting on, that means a wikilink stays a wikilink - and a vault that wants Markdown links everywhere never gets them.

The **Link style** setting (`linkStyleMode`) decides which style is written:

- **Preserve existing**
  - keep each link's existing wikilink-vs-markdown style when converting it.
- **Obsidian settings default** (the default)
  - follow the **Use `[[Wikilinks]]`** Obsidian setting.
- **Markdown**
  - always write `[alias](<path/to/target.md>)`, whatever that Obsidian setting says. This one also applies to links the plugin generates from scratch and to embeds being demoted, not only to links being converted.

Three commands force the Markdown style for a single run, leaving the setting alone - the replacement for **Replace all wikilinks with markdown links** and its siblings from [Consistent Attachments and Links](https://github.com/mnaoumov/obsidian-consistent-attachments-and-links):

- **Better Markdown Links: Convert links to Markdown in current file**
- **Better Markdown Links: Convert links to Markdown in current folder**
- **Better Markdown Links: Convert links to Markdown in entire vault**

The button writes a note of plain wikilinks and opens it:

```code-button
---
caption: Create a note full of wikilinks
---
await require('/demoSetup.ts').openWikilinkNote(app);
```

Manual equivalent: create a note and write some `[[wikilinks]]` in it.

```code-button
---
caption: Convert links normally (wikilinks survive)
---
require('/demoSetup.ts').convertLinksInCurrentFile(app);
```

```code-button
---
caption: Convert links to Markdown (wikilinks do not)
---
require('/demoSetup.ts').convertLinksToMarkdownInCurrentFile(app);
```

Manual equivalent: run **Better Markdown Links: Convert links to Markdown in current file** from the Command Palette.

The same thing permanently, by setting rather than by command:

```code-button
---
caption: Always write Markdown links
---
await require('/demoSetup.ts').changeSettings(app, { linkStyleMode: 'Markdown' });
```

```code-button
---
caption: Back to the default (follow the Obsidian setting)
---
await require('/demoSetup.ts').changeSettings(app, { linkStyleMode: 'ObsidianSettingsDefault' });
```

Manual equivalent: pick from the **Link style** dropdown in **Settings -> Community plugins -> Better Markdown Links**.

## Links that do not resolve

A wikilink can name a note by an **alias** — `[[The Simple One]]`, where `The Simple One` appears in another note's `aliases` frontmatter rather than in its file name. Obsidian resolves that fine. A markdown link cannot: it has only a path. So converting an alias-only wikilink naively produces `[The Simple One](<The Simple One.md>)`, pointing at a note that does not exist.

Two opt-in settings deal with this, applied in order and **only when you run a convert command yourself**. The automatic modes above never trigger them — creating notes on every auto-save would litter the vault.

- **Should resolve links via aliases** (`shouldResolveLinksViaAliases`)
  - looks an unresolved wikilink up against every note's `aliases` frontmatter and its basename, and points the converted link at whatever it finds.
- **Should create missing notes** (`shouldCreateMissingNotes`)
  - creates the note when the alias lookup finds nothing, in the folder your **Default location for new notes** Obsidian setting names. This writes new files to your vault.

The button writes a note with one of each — a wikilink naming an alias, and a wikilink naming nothing at all — plus the aliased note the first one is meant to find:

```code-button
---
caption: Create a note with unresolved wikilinks
---
await require('/demoSetup.ts').openUnresolvedNote(app);
```

```code-button
---
caption: Turn both resolution settings on
---
await require('/demoSetup.ts').changeSettings(app, { shouldCreateMissingNotes: true, shouldResolveLinksViaAliases: true });
```

```code-button
---
caption: Convert the unresolved links note
---
require('/demoSetup.ts').convertLinksInCurrentFile(app);
```

The first link now points at `Aliased note.md`; the second has a freshly created note behind it.

```code-button
---
caption: Back to the defaults (both off)
---
await require('/demoSetup.ts').changeSettings(app, { shouldCreateMissingNotes: false, shouldResolveLinksViaAliases: false });
```

Manual equivalent: toggle the two settings in **Settings -> Community plugins -> Better Markdown Links**, then run **Better Markdown Links: Convert links in current file**.

## File link normalization

With **Should normalize file links** enabled (the default), external `file://` links are tidied up during conversion - backslashes become forward slashes and percent-encoding is decoded:

```markdown
[note](file:///C:%5Cnotes%5Cplan.md)   ->   [note](file:///C:/notes/plan.md)
```

See [05 Settings](<./05 Settings.md>) for every option that shapes the conversion.
