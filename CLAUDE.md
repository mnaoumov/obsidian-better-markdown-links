# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Better Markdown Links is an Obsidian plugin that adds support for angle bracket links (`[Title](<path with space/note.md>)`) and manages relative links properly (prepending `./`), plus link conversion (per-file, per-folder, entire-vault, and automatic), automatic rename/move link updates, and an extended `app.fileManager.generateMarkdownLink()` overload. It is built on `obsidian-dev-utils` (a dev dependency providing the `PluginBase`, component, command-handler, and link utilities the plugin composes).

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
  - `plugin.ts` — `Plugin extends PluginBase`; `onloadImpl()` wires up all child components (settings, link conversion, rename/delete handling, and command handlers)
  - `better-markdown-links-component.ts` — `LayoutReadyComponent` that installs the patches, listens for vault `modify` events, and auto-converts links in modified files
  - `link-converter.ts` — `LinkConverter` performing the actual link conversion in the current file, a file, a folder, or the entire vault
  - `plugin-settings.ts` — `PluginSettings` model (angle brackets, leading dot/slash, auto-convert/update toggles, include/exclude paths, link style)
  - `plugin-settings-component.ts` — settings persistence, legacy-settings converters, and validators
  - `plugin-settings-tab.ts` — settings UI tab (`PluginSettingsTabBase`)
  - `generate-markdown-link-extended.d.ts` — type declarations for the extended `generateMarkdownLink` overload (`LinkPathStyle`/`LinkStyle` enums, options interface)
  - `generate-markdown-link-extended-impl.ts` — `GenerateMarkdownLinkPatchComponent` patching `fileManager.generateMarkdownLink` and adding the `.extended(...)` method
  - `commands/` — three `CommandHandler` subclasses: convert links in file, in folder, and in entire vault
  - `patches/workspace-open-link-text-patch-component.ts` — `MonkeyAroundComponent` patching `Workspace.openLinkText` to convert links on navigation
  - `styles/` — `main.scss` plus `scss.d.ts` ambient module declaration
- **`main` field** points to `src/main.ts` (Obsidian plugin source entry; built artifact is `dist/build/main.js`, not published to npm).

## Known Issues

None.
