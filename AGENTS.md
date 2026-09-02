# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Better Markdown Links is an Obsidian plugin that adds support for angle bracket links (`[Title](<path with space/note.md>)`) and manages relative links properly (prepending `./`), plus link conversion (per-file, per-folder, entire-vault, and automatic), a force-Markdown link style that overrides Obsidian's own `Use [[Wikilinks]]` setting (as a setting and as its own command triad), demotion of embeds to plain links, resolution of wikilinks Obsidian cannot resolve (by alias, or by creating the missing note), and an extended `app.fileManager.generateMarkdownLink()` overload. Rename/delete handling was dropped in 5.0.0 and belongs to the `advanced-rename-and-delete-handler` plugin; this plugin only suggests that plugin and offers it the settings the old handler used. It is built on `obsidian-dev-utils` (a dev dependency providing the `PluginBase`, component, command-handler, and link utilities the plugin composes).

## Commands

| Task              | Command                    |
|-------------------|----------------------------|
| TypeScript check  | `npm run build:compile`    |
| Build             | `npm run build`            |
| Dev (watch)       | `npm run dev`              |
| Lint              | `npm run lint`             |
| Lint (fix)        | `npm run lint:fix`         |
| Format            | `npm run format`           |
| Format (check)    | `npm run format:check`     |
| Spellcheck        | `npm run spellcheck`       |
| Markdown lint     | `npm run lint:md`          |
| Markdown lint fix | `npm run lint:md:fix`      |
| Unit tests        | `npm test`                 |
| Coverage          | `npm run test:coverage`    |
| Integration tests | `npm run test:integration` |
| Commit (wizard)   | `npm run commit`           |

## Architecture

- **Root config files** are thin re-exports — actual logic lives in `scripts/` (e.g. `eslint.config.mts` → `scripts/eslint-config.ts`).
- **`src/`** — plugin source:
  - `main.ts` — Obsidian entry point (imports the SCSS bundle and re-exports `Plugin` as the default export)
  - `plugin.ts` — `Plugin extends PluginBase`; `onloadImpl()` wires up all child components (settings, the Advanced Rename and Delete Handler suggestion, link conversion, the rename/delete settings migration, and command handlers)
  - `advanced-rename-and-delete-handler.ts` — the id and display name of the plugin that owns rename/delete handling since 5.0.0, written once and shared by the suggestion and the migration
  - `rename-delete-handler-migration-component.ts` — offers the legacy rename setting (with the include/exclude paths that scoped it) to that plugin's `migrateSettings` API under contract `^1`, and retires the pending value only once the user applies the migration
  - `better-markdown-links-component.ts` — `LayoutReadyComponent` that installs the patches and dispatches conversion by trigger: `handleModify` (vault `modify`), `handleSave` (editor save, via the save patch), and `handleNavigation` (link navigation). Gating lives on `PluginSettings` (`shouldConvertLinksOn*`). The `processFile` gate also triggers conversion when a note's only pending change is a `file://` normalization — it parses external links (`getCacheSafe` with `shouldParse{External,FrontmatterExternal,MultiValueFrontmatterExternal}Links`) and checks `parseLinkResult.isFileUrl`. It also owns the `GenerateMarkdownLinkDefaultParamsComponent` registration that maps the settings onto every generated link — `removeUndefinedProperties`, so an absent `linkStyle` stands aside for another plugin's default rather than clobbering it with `undefined`
  - `link-converter.ts` — `LinkConverter` performing the actual link conversion in the current file, a file, a folder, or the entire vault; also normalizes `file://` links (via `updateFileUrlLinksInFile`) when `shouldNormalizeFileLinks` is enabled, so every conversion surface (commands + automatic triggers) picks it up. `shouldForceMarkdownLinkStyle` overrides `getLinkStyle()` with `LinkStyle.Markdown` for one run, which is what the `Convert links to Markdown` commands pass
  - `link-conversion-mode.ts` — `LinkConversionMode` enum (dependency-free so it can be imported as a value from node-based integration tests without loading `obsidian`)
  - `link-style-mode.ts` — `LinkStyleMode` enum (`Markdown` / `ObsidianSettingsDefault` / `PreserveExisting`), dependency-free for the same reason. `Wikilink` is deliberately not offered
  - `plugin-settings.ts` — `PluginSettings` model (angle brackets, leading dot/slash, `linkConversionMode`, `linkStyleMode`, include/exclude paths, `shouldNormalizeFileLinks` for `file://` link normalization, `shouldAppendFileNameWhenDemotingEmbeds`, `shouldResolveLinksViaAliases`, `shouldCreateMissingNotes`, plus the two rename-handover bookkeeping keys). Two link-style accessors, not one: `getLinkStyle()` for links being CONVERTED, and `getGeneratedLinkStyle()` for links being GENERATED — the latter returns `undefined` outside the `Markdown` mode, because saying `ObsidianSettingsDefault` out loud would beat the `originalLink` inference embed demotion depends on
  - `plugin-settings-component.ts` — settings persistence, legacy-settings converters, and validators
  - `plugin-settings-tab.ts` — settings UI tab (`PluginSettingsTabBase`)
  - `generate-markdown-link-extended.d.ts` — type declarations for the extended `generateMarkdownLink` overload (`LinkPathStyle`/`LinkStyle` enums, options interface)
  - `generate-markdown-link-extended-impl.ts` — `GenerateMarkdownLinkPatchComponent` patching `fileManager.generateMarkdownLink` and adding the `.extended(...)` method
  - `embed-demoter.ts` — `EmbedDemoter`, demoting embeds to plain links in a file, a folder, or the entire vault. Conversion of the link's FORM only; the path style and wikilink-vs-markdown style stay `LinkConverter`'s job, which is why `generateMarkdownLink` is passed `originalLink` and only `isEmbed: false`. An embed with an empty alias pointing at a NOTE gains the target's basename, because `[](<x.md>)` would render as nothing
  - `unresolved-link-resolver.ts` — `resolveUnresolvedLinksInFile`, run by `LinkConverter` BEFORE `updateLinksInFile`. Points a wikilink Obsidian cannot resolve at a real note, by looking its text up against every note's `aliases` frontmatter and basename, and optionally by creating the note (in `fileManager.getNewFileParent()`'s folder). **Gated on `shouldResolveUnresolvedLinks`, which only the explicit convert commands pass** — wiring it to the automatic paths would create a note on every auto-save. `src/demote-and-resolve.desktop.integration.test.ts` asserts that invariant against a real Obsidian
  - `commands/` — nine `CommandHandler` subclasses: convert links, convert links to Markdown, and demote embeds, each in file, in folder, and in entire vault. The convert-to-Markdown triad is palette-only (it does not override `shouldAddToFileMenu` / `shouldAddToFolderMenu`, whose base defaults are `false`), because a second nearly identically named row beside its style-agnostic sibling would cost more than it explains
  - `patches/workspace-open-link-text-patch-component.ts` — `MonkeyAroundComponent` patching `Workspace.openLinkText` to convert links on navigation
  - `patches/text-file-view-save-patch-component.ts` — `MonkeyAroundComponent` patching `TextFileView.save` (fires on auto-save and Ctrl+S, never on external writes) to convert after the write
  - `patches/editor-save-file-command-patch-component.ts` — `MonkeyAroundComponent` patching the `editor:save-file` command's `checkCallback` to tag the active file so a Ctrl+S save is distinguishable from an auto-save
  - `styles/` — `main.scss` plus `scss.d.ts` ambient module declaration
- **`main` field** points to `src/main.ts` (Obsidian plugin source entry; built artifact is `dist/build/main.js`, not published to npm).
