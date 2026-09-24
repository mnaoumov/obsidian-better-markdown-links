# Convert links

Beyond formatting new links, Better Markdown Links can rewrite links that already exist so they match the configured style (angle brackets, leading dots, normalized `file://` links, and so on).

## On demand

Three style-agnostic commands are available in the Command Palette (three more force the Markdown style - see [Forcing Markdown links](#forcing-markdown-links) below - and three more force relative paths - see [Forcing a link path style](#forcing-a-link-path-style)):

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

## Forcing a link path style

The section above decides a link's *style* - wikilink or Markdown. This one decides its *path*: the same note can be named three different ways, and Obsidian's own **New link format** setting picks which.

The **Link path style** setting (`linkPathStyleMode`) overrides that:

- **Obsidian settings default** (the default)
  - follow the **New link format** Obsidian setting.
- **Relative path to the source**
  - always write the path relative to the note the link is in: `[Deep note](<./Targets/Nested folder/Deep note.md>)`.
- **Shortest path when possible**
  - always write the shortest path that still resolves to a single note: `[Deep note](<Deep note.md>)`.
- **Absolute path in vault**
  - always write the path from the vault root: `[Deep note](</Materials/02 Relative links/Targets/Nested folder/Deep note.md>)`.

Outside the default, the **Should use leading dot for relative paths** and **Should use leading slash for absolute paths** settings from [02 Relative links](<./02 Relative links.md>) are applied as written rather than copied from the link being replaced - which is the whole point, since a link that was absolute has no `./` to copy.

Three commands force the relative style for a single run, leaving the setting alone - the replacement for **Convert all link paths to relative** and its siblings from [Consistent Attachments and Links](https://github.com/mnaoumov/obsidian-consistent-attachments-and-links):

- **Better Markdown Links: Convert link paths to relative in current file**
- **Better Markdown Links: Convert link paths to relative in current folder**
- **Better Markdown Links: Convert link paths to relative in entire vault**

The button writes a note whose links name their targets by bare file name and by vault-absolute path, and opens it:

```code-button
---
caption: Create a note with non-relative link paths
---
await require('/demoSetup.ts').openPathStyleNote(app);
```

Manual equivalent: create a note and write some links that name their target by file name alone.

```code-button
---
caption: Convert link paths to relative
---
require('/demoSetup.ts').convertLinkPathsToRelativeInCurrentFile(app);
```

Manual equivalent: run **Better Markdown Links: Convert link paths to relative in current file** from the Command Palette.

The same thing permanently, by setting rather than by command:

```code-button
---
caption: Always write relative paths
---
await require('/demoSetup.ts').changeSettings(app, { linkPathStyleMode: 'RelativePathToTheSource' });
```

```code-button
---
caption: Always write the shortest path
---
await require('/demoSetup.ts').changeSettings(app, { linkPathStyleMode: 'ShortestPathWhenPossible' });
```

```code-button
---
caption: Back to the default link path style
---
await require('/demoSetup.ts').changeSettings(app, { linkPathStyleMode: 'ObsidianSettingsDefault' });
```

Manual equivalent: pick from the **Link path style** dropdown in **Settings -> Community plugins -> Better Markdown Links**.

## Links that do not resolve

A wikilink can name a note by an **alias** — `[[The Simple One]]`, where `The Simple One` appears in another note's `aliases` frontmatter rather than in its file name. Obsidian resolves that fine. A markdown link cannot: it has only a path. So converting an alias-only wikilink naively produces `[The Simple One](<The Simple One.md>)`, pointing at a note that does not exist.

Two opt-in settings deal with this, applied in order and **only when you run a convert command yourself**. The automatic modes above never trigger them — creating notes on every auto-save would litter the vault.

- **Should resolve links via aliases** (`shouldResolveLinksViaAliases`)
  - looks an unresolved wikilink up against every note's `aliases` frontmatter and its basename, and points the converted link at the note when **exactly one** answers to the name.
  - when several notes carry the name, the link is left exactly as it is. There is no right answer to write, and the unresolved marker Obsidian is showing you is information rather than a gap to be filled.
  - off by default because the lookup also matches by file name, and a wikilink only reaches it once Obsidian itself has failed to resolve it: a file-name match here is one Obsidian refused, found only through this plugin's laxer casing and spacing rules.
- **Should create missing notes** (`shouldCreateMissingNotes`)
  - creates the note when the alias lookup finds nothing, in the folder your **Default location for new notes** Obsidian setting names. This writes new files to your vault.
  - a name several notes already carry is ambiguous, not missing, so nothing is created for it.

The button writes a note with one of each — a wikilink naming an alias, a wikilink naming nothing at all, and a wikilink naming an alias that two notes answer to — plus the aliased note the first one is meant to find and the two rivals that make the third ambiguous:

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

The first link now points at `Aliased note.md`; the second has a freshly created note behind it. The third is untouched, still `[[The Contested One]]` and still showing as unresolved — two notes answer to that name, so there is nothing right to point it at, and nothing was created for it either.

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
