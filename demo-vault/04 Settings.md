[Docs](https://github.com/mnaoumov/obsidian-better-markdown-links/)

# Settings

Open **Settings -> Community plugins -> Better Markdown Links** to configure the plugin. Each option
below lists the setting key stored in the plugin's `data.json`.

## Link style

- `shouldUseAngleBrackets` - wrap links whose path has spaces in `<...>` instead of percent-encoding
  them (see [[01 Angle bracket links]]).
- `shouldUseLeadingDotForRelativePaths` - prepend `./` to relative links (see [[02 Relative links]]).
- `shouldUseLeadingSlashForAbsolutePaths` - prepend `/` to vault-absolute links.
- `shouldPreserveExistingLinkStyle` - when converting, keep a link's existing wikilink/markdown style
  instead of forcing Obsidian's default.
- `shouldNormalizeFileLinks` - tidy external `file://` links (decode and use forward slashes) while
  converting (see [[03 Convert links]]).

## Conversion

- `linkConversionMode` - when links are converted automatically: on explicit command, on save
  command, on auto save, or on every modification (see [[03 Convert links]]).

## Embeds

- `shouldAllowEmptyEmbedAlias` - allow embeds to keep an empty alias instead of filling one in.
- `shouldIncludeAttachmentExtensionToEmbedAlias` - include the file extension in an attachment
  embed's generated alias.

## Rename and move

- `shouldAutomaticallyUpdateLinksOnRenameOrMove` - update links pointing at a note when it is
  renamed or moved to another folder.

## Scope

- `includePaths` - only convert links in files matching these paths (empty means all files).
- `excludePaths` - never convert links in files matching these paths; defaults to skipping
  Excalidraw and tldraw notes.
