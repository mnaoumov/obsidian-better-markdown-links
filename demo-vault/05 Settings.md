# Settings

Open **Settings -> Community plugins -> `Better Markdown Links`** to configure the plugin. Each option below lists the setting key stored in the plugin's `data.json`.

## Link style

- `shouldUseAngleBrackets`
  - wrap links whose path has spaces in `<...>` instead of percent-encoding them (see [01 Angle bracket links](<./01 Angle bracket links.md>)).
- `shouldUseLeadingDotForRelativePaths`
  - prepend `./` to relative links (see [02 Relative links](<./02 Relative links.md>)).
- `shouldUseLeadingSlashForAbsolutePaths`
  - prepend `/` to vault-absolute links.
- `linkStyleMode`
  - which link style to write: `PreserveExisting` keeps each link's existing wikilink-vs-markdown style, `ObsidianSettingsDefault` follows Obsidian's **Use `[[Wikilinks]]`** setting, and `Markdown` always writes markdown links whatever that setting says (see [03 Convert links](<./03 Convert links.md>)).
- `shouldConvertFrontmatterWikilinksToMarkdown`
  - convert a wikilink in a note's properties to a markdown link too. Off by default, because Obsidian treats a property as a link only when it is a wikilink; turn it on only where another plugin makes markdown links work there (see [03 Convert links](<./03 Convert links.md#wikilinks-in-properties>)).
- `linkPathStyleMode`
  - which link path style to write: `ObsidianSettingsDefault` follows Obsidian's **New link format** setting, while `RelativePathToTheSource`, `ShortestPathWhenPossible` and `AbsolutePathInVault` each override it. Outside the default, the two settings above are applied as written rather than copied from the link being replaced (see [03 Convert links](<./03 Convert links.md>)).
- `shouldNormalizeFileLinks`
  - tidy external `file://` links (decode and use forward slashes) while converting (see [03 Convert links](<./03 Convert links.md>)).

## Conversion

- `linkConversionMode`
  - when links are converted automatically: on explicit command, on save command, on auto save, or on every modification (see [03 Convert links](<./03 Convert links.md>)).
- `shouldResolveLinksViaAliases`
  - look an unresolved wikilink up against every note's `aliases` frontmatter and basename before converting it; explicit commands only (see [03 Convert links](<./03 Convert links.md>)).
- `shouldCreateMissingNotes`
  - create the note when a wikilink still does not resolve after the alias lookup; explicit commands only, and it writes new files (see [03 Convert links](<./03 Convert links.md>)).

## Embeds

- `shouldAllowEmptyEmbedAlias`
  - allow embeds to keep an empty alias instead of filling one in.
- `shouldIncludeAttachmentExtensionToEmbedAlias`
  - include the file extension in an attachment embed's generated alias.
- `shouldAppendFileNameWhenDemotingEmbeds`
  - append the target's file name as a sub-bullet when demoting an embed to a link (see [04 Demote embeds](<./04 Demote embeds.md>)).

## Undo with git

- `shouldCommitBulkOperations`
  - desktop only, off by default. When the vault is inside a git repository, every in-folder and entire-vault command run (convert links, convert links to Markdown, convert link paths to relative, demote embeds) is recorded as two commits: `chore: before OP<n>` with whatever was pending, then `OP<n>: <command> in <folder>` with the run's own changes. The **`Better Markdown Links`: Undo a bulk operation...** command lists those runs and reverts the one you pick with `git revert`; a conflict is left for you to resolve. It uses the system `git`, so the repository's own config, hooks and filters apply.

## Renames moved to another plugin

Up to version 4, this plugin updated the links pointing at a note when you renamed or moved it. Since **5.0.0** it does not: rename and delete handling is owned by [Advanced Rename and Delete Handler](https://github.com/mnaoumov/obsidian-advanced-rename-and-delete-handler), a separate plugin, so a vault has exactly one of them rather than one per plugin that happened to bundle a copy.

Nothing here replaces it. Install that plugin and its settings tab holds every rename and delete option, including the toggle that used to live on this page. Decline, and this plugin keeps all of its other features while Obsidian's own link update runs on renames - it just will not write the readable link format the rest of this vault is about.

Two keys are left behind to make the handover work. Neither is a toggle you set - they are bookkeeping, shown here because they are in your `data.json`:

- `isAdvancedRenameAndDeleteHandlerSuggestionDeclined`
  - whether you have already answered "not now" to the suggestion notice. It silences the notice, not the banner at the top of this tab: opening these settings is a fresher signal than an answer you gave earlier.
- `proposedShouldHandleRenames`
  - the rename-handling value you had before the upgrade, held until it can be offered to `Advanced Rename and Delete Handler`. The offer carries the two scope settings below along with it, since they scoped this plugin's own handler. It is `null` once the offer has been accepted, and on a fresh install that never had the old setting. Cancelling the offer leaves it here, so it comes back next time.

## Scope

- `includePaths`
  - only convert links in files matching these paths (empty means all files).
- `excludePaths`
  - never convert links in files matching these paths; defaults to skipping `Excalidraw` and `tldraw` notes.
- `excludeLinkTargetPaths`
  - leave a link exactly as written when its TARGET matches these paths, while every other link in the same note is still converted (empty means no link is left alone). The target is the file the link resolves to, or the path an unresolved link names; for an external link it is its URL. An excluded link is not converted, restyled, normalized, demoted or resolved, and no note is created for it. `*.base` keeps `![[file.base]]` embeds for a publisher that only reads the wikilink form, and unlike a list of note paths it means the same thing in every vault.

Each entry of any of these lists takes one of three forms, and every form matches case-insensitively:

- a path, such as `Notes/Daily`, which matches that path and everything inside it;
- a glob, such as `*.pdf`, `Notes/**/*.md` or `tmp*/`: `*` matches within one folder level, `**` across levels, `?` one character and `[abc]` / `[!abc]` a character class. A glob without `/` matches a name at any depth, and a trailing `/` matches folders only;
- a regular expression, written `/pattern/flags`.

A path that contains a literal `*`, `?` or `[` escapes it with `\`, as in `Notes \[old\]`, or it is read as a glob.
