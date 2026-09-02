# Settings

Open **Settings -> Community plugins -> Better Markdown Links** to configure the plugin. Each option below lists the setting key stored in the plugin's `data.json`.

## Link style

- `shouldUseAngleBrackets`
  - wrap links whose path has spaces in `<...>` instead of percent-encoding them (see [01 Angle bracket links](<./01 Angle bracket links.md>)).
- `shouldUseLeadingDotForRelativePaths`
  - prepend `./` to relative links (see [02 Relative links](<./02 Relative links.md>)).
- `shouldUseLeadingSlashForAbsolutePaths`
  - prepend `/` to vault-absolute links.
- `shouldPreserveExistingLinkStyle`
  - when converting, keep a link's existing wikilink/markdown style instead of forcing Obsidian's default.
- `shouldNormalizeFileLinks`
  - tidy external `file://` links (decode and use forward slashes) while converting (see [03 Convert links](<./03 Convert links.md>)).

## Conversion

- `linkConversionMode`
  - when links are converted automatically: on explicit command, on save command, on auto save, or on every modification (see [03 Convert links](<./03 Convert links.md>)).

## Embeds

- `shouldAllowEmptyEmbedAlias`
  - allow embeds to keep an empty alias instead of filling one in.
- `shouldIncludeAttachmentExtensionToEmbedAlias`
  - include the file extension in an attachment embed's generated alias.

## Renames moved to another plugin

Up to version 4, this plugin updated the links pointing at a note when you renamed or moved it. Since **5.0.0** it does not: rename and delete handling is owned by [Advanced Rename and Delete Handler](https://github.com/mnaoumov/obsidian-advanced-rename-and-delete-handler), a separate plugin, so a vault has exactly one of them rather than one per plugin that happened to bundle a copy.

Nothing here replaces it. Install that plugin and its settings tab holds every rename and delete option, including the toggle that used to live on this page. Decline, and this plugin keeps all of its other features while Obsidian's own link update runs on renames - it just will not write the readable link format the rest of this vault is about.

Two keys are left behind to make the handover work. Neither is a toggle you set - they are bookkeeping, shown here because they are in your `data.json`:

- `isAdvancedRenameAndDeleteHandlerSuggestionDeclined`
  - whether you have already answered "not now" to the suggestion notice. It silences the notice, not the banner at the top of this tab: opening these settings is a fresher signal than an answer you gave earlier.
- `proposedShouldHandleRenames`
  - the rename-handling value you had before the upgrade, held until it can be offered to Advanced Rename and Delete Handler. The offer carries the two scope settings below along with it, since they scoped this plugin's own handler. It is `null` once the offer has been accepted, and on a fresh install that never had the old setting. Cancelling the offer leaves it here, so it comes back next time.

## Scope

- `includePaths`
  - only convert links in files matching these paths (empty means all files).
- `excludePaths`
  - never convert links in files matching these paths; defaults to skipping Excalidraw and tldraw notes.
