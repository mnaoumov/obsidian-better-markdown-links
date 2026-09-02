# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Better Markdown Links is an Obsidian plugin that adds support for angle bracket links (`[Title](<path with space/note.md>)`) and manages relative links properly (prepending `./`), plus link conversion (per-file, per-folder, entire-vault, and automatic) and an extended `app.fileManager.generateMarkdownLink()` overload. Rename/delete handling was dropped in 5.0.0 and belongs to the `advanced-rename-and-delete-handler` plugin; this plugin only suggests that plugin and offers it the settings the old handler used. It is built on `obsidian-dev-utils` (a dev dependency providing the `PluginBase`, component, command-handler, and link utilities the plugin composes).

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
  - `better-markdown-links-component.ts` — `LayoutReadyComponent` that installs the patches and dispatches conversion by trigger: `handleModify` (vault `modify`), `handleSave` (editor save, via the save patch), and `handleNavigation` (link navigation). Gating lives on `PluginSettings` (`shouldConvertLinksOn*`). The `processFile` gate also triggers conversion when a note's only pending change is a `file://` normalization — it parses external links (`getCacheSafe` with `shouldParse{External,FrontmatterExternal,MultiValueFrontmatterExternal}Links`) and checks `parseLinkResult.isFileUrl`
  - `link-converter.ts` — `LinkConverter` performing the actual link conversion in the current file, a file, a folder, or the entire vault; also normalizes `file://` links (via `updateFileUrlLinksInFile`) when `shouldNormalizeFileLinks` is enabled, so every conversion surface (commands + automatic triggers) picks it up
  - `link-conversion-mode.ts` — `LinkConversionMode` enum (dependency-free so it can be imported as a value from node-based integration tests without loading `obsidian`)
  - `plugin-settings.ts` — `PluginSettings` model (angle brackets, leading dot/slash, `linkConversionMode`, include/exclude paths, link style, `shouldNormalizeFileLinks` for `file://` link normalization, plus the two rename-handover bookkeeping keys)
  - `plugin-settings-component.ts` — settings persistence, legacy-settings converters, and validators
  - `plugin-settings-tab.ts` — settings UI tab (`PluginSettingsTabBase`)
  - `generate-markdown-link-extended.d.ts` — type declarations for the extended `generateMarkdownLink` overload (`LinkPathStyle`/`LinkStyle` enums, options interface)
  - `generate-markdown-link-extended-impl.ts` — `GenerateMarkdownLinkPatchComponent` patching `fileManager.generateMarkdownLink` and adding the `.extended(...)` method
  - `commands/` — three `CommandHandler` subclasses: convert links in file, in folder, and in entire vault
  - `patches/workspace-open-link-text-patch-component.ts` — `MonkeyAroundComponent` patching `Workspace.openLinkText` to convert links on navigation
  - `patches/text-file-view-save-patch-component.ts` — `MonkeyAroundComponent` patching `TextFileView.save` (fires on auto-save and Ctrl+S, never on external writes) to convert after the write
  - `patches/editor-save-file-command-patch-component.ts` — `MonkeyAroundComponent` patching the `editor:save-file` command's `checkCallback` to tag the active file so a Ctrl+S save is distinguishable from an auto-save
  - `styles/` — `main.scss` plus `scss.d.ts` ambient module declaration
- **`main` field** points to `src/main.ts` (Obsidian plugin source entry; built artifact is `dist/build/main.js`, not published to npm).
