# Better Markdown Links

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov) [![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-better-markdown-links)](https://github.com/mnaoumov/obsidian-better-markdown-links/releases) [![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-better-markdown-links/total)](https://github.com/mnaoumov/obsidian-better-markdown-links/releases) [![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/mnaoumov/obsidian-better-markdown-links)

`[[Wikilinks]]` are not part of the Markdown spec, so a vault that uses them stops making sense outside [Obsidian]. Switch to Markdown links and you hit the next problem: Obsidian writes `[Title](path%20with%20space/note%20with%20space.md)`, which is unreadable, and it writes relative paths without a leading `./`, which other editors resolve differently than Obsidian does — the same link, two meanings.

This plugin makes Obsidian generate the readable, unambiguous form instead: angle brackets around paths with spaces, an explicit `./` on relative links, and tidy `file://` URLs. It can also convert the links you already have, in one note, one folder, or the whole vault — and decide for itself which style and which path form to write, rather than following Obsidian's own settings.

<!-- markdownlint-disable MD033 -->

<a href="https://github.com/mnaoumov/obsidian-better-markdown-links/blob/HEAD/images/screenshots/screenshot-desktop-1.png"><img src="images/screenshots/screenshot-desktop-1.png" alt="What you get by default: percent-escapes and bare paths" width="600"></a>

<details>
<summary>More screenshots</summary>

<div>
<a href="https://github.com/mnaoumov/obsidian-better-markdown-links/blob/HEAD/images/screenshots/screenshot-desktop-2.png"><img src="images/screenshots/screenshot-desktop-2.png" alt="Readable paths, angle brackets, an explicit ./" width="600"></a>
<a href="https://github.com/mnaoumov/obsidian-better-markdown-links/blob/HEAD/images/screenshots/screenshot-desktop-3.png"><img src="images/screenshots/screenshot-desktop-3.png" alt="Convert one note, one folder, or the whole vault" width="600"></a>
<a href="https://github.com/mnaoumov/obsidian-better-markdown-links/blob/HEAD/images/screenshots/screenshot-mobile-1.png"><img src="images/screenshots/screenshot-mobile-1.png" alt="What you get by default: percent-escapes and bare paths" width="270"></a>
<a href="https://github.com/mnaoumov/obsidian-better-markdown-links/blob/HEAD/images/screenshots/screenshot-mobile-2.png"><img src="images/screenshots/screenshot-mobile-2.png" alt="Readable paths, angle brackets, an explicit ./" width="270"></a>
<a href="https://github.com/mnaoumov/obsidian-better-markdown-links/blob/HEAD/images/screenshots/screenshot-mobile-3.png"><img src="images/screenshots/screenshot-mobile-3.png" alt="Convert one note, one folder, or the whole vault" width="270"></a>
</div>

</details>

<!-- markdownlint-enable MD033 -->

## Demo vault

**The documentation is a demo vault.** Every feature has a note that explains what it does and why you would want it, with awkward paths already in place to try it against.

**[Start reading here](<./demo-vault/00 Start.md>)** — it is plain markdown, so it works on GitHub with nothing installed.

A copy of the vault ships with every release. You can access it via any of the following:

1. Running the **`Better Markdown Links`: Open demo vault** command.
2. Downloading `better-markdown-links-demo-vault.zip` from the [Releases](https://github.com/mnaoumov/obsidian-better-markdown-links/releases). It unzips into a single `better-markdown-links-demo-vault-<version>` folder.
3. Browsing its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

## What it does

- **Angle bracket links** — `[Title](<path with space/note.md>)` instead of `%20` noise: [01 Angle bracket links](<./demo-vault/01 Angle bracket links.md>).
- **Explicit relative links** — a leading `./`, so a relative path cannot be mistaken for an absolute one: [02 Relative links](<./demo-vault/02 Relative links.md>).
- **Convert what you already have** — a selection, a note, a folder or the whole vault, on command or automatically as you save: [03 Convert links](<./demo-vault/03 Convert links.md>).
- **`file://` normalization** — escaped backslashes in a `file://` link become plain forward slashes: [03 Convert links](<./demo-vault/03 Convert links.md>).
- **Force Markdown links** — whatever Obsidian's **Use `[[Wikilinks]]`** setting says, permanently or for one run: [03 Convert links](<./demo-vault/03 Convert links.md>).
- **Force a link path style** — relative, shortest or vault-absolute, whatever Obsidian's **New link format** setting says: [03 Convert links](<./demo-vault/03 Convert links.md>).
- **Demote embeds to links** — strip the `!` off every embed in a selection, a note, a folder or the vault: [04 Demote embeds](<./demo-vault/04 Demote embeds.md>).
- **Links that do not resolve** — point an alias-only wikilink at the note carrying the alias, or create the note: [03 Convert links](<./demo-vault/03 Convert links.md>).
- **Undo a folder or vault run with git** — in a vault kept in git, each in-folder or entire-vault run becomes one commit that the **Undo a bulk operation...** command reverts: [05 Settings](<./demo-vault/05 Settings.md#undo-with-git>).
- **Leave chosen links alone** — keep links to matching targets, such as `![[file.base]]` embeds, exactly as written while converting the rest: [03 Convert links](<./demo-vault/03 Convert links.md>).

## Integration with other plugins

- Since **5.0.0**, renames and deletes are handled by [`Advanced Rename and Delete Handler`](https://community.obsidian.md/plugins/advanced-rename-and-delete-handler), which this plugin offers to install: [05 Settings](<./demo-vault/05 Settings.md>).
- [`Backlink Cache`](https://community.obsidian.md/plugins/backlink-cache) speeds this plugin up on a large vault.
- [`Advanced Metadata Cache`](https://github.com/mnaoumov/obsidian-advanced-metadata-cache), with its **Names** module on, speeds up resolving links via aliases: [03 Convert links](<./demo-vault/03 Convert links.md>).

## See also

[My other Obsidian resources](https://github.com/mnaoumov/obsidian-resources)

| Plugin | Features | How `Better Markdown Links` differs |
| --- | --- | --- |
| [`Alias Linker`](https://community.obsidian.md/plugins/alias-linker) | Resolves bare alias links without edits; nearest-note tie-breaking | Alternative alias handling: explicit rewrite to a unique target |
| [`Better Relative Wikilinks`](https://community.obsidian.md/plugins/better-relative-wikilinks) | Relative wikilinks only for ambiguous names | Alternative path policy: one style for all links, including Markdown |
| [`Embed Link Converter`](https://community.obsidian.md/plugins/embed-link-converter) | Image-embed syntax conversion; preview and backups; paths unchanged | Overlaps on conversion; all link paths/styles; demotes embeds to links rather than changing embed syntax |
| [`Link Converter`](https://community.obsidian.md/plugins/obsidian-link-converter) | Converts wikilink/Markdown syntax and relative, absolute or shortest paths | Broader conversion: selections/folders, angle brackets, leading `./` and automatic save-time conversion |
| [`Logseq Style Alias`](https://community.obsidian.md/plugins/logseq-style-alias) | Resolves bare alias links without edits; empty-note cleanup | Alternative alias handling: explicit rewrites; optional note creation |
| [`Markdown Link Space Encoder`](https://community.obsidian.md/plugins/markdown-link-space-encoder) | Encodes selected spaces as `%20` | Alternative space handling: angle-bracketed paths; spaces preserved |
| [`Update Relative Links`](https://community.obsidian.md/plugins/update-relative-links) | Repairs relative Markdown paths on moves; converts paths to relative | Overlaps on paths; other path styles and angle brackets; delegates move handling |
| [`Wikilinks to MDLinks`](https://community.obsidian.md/plugins/wikilinks-to-mdlinks-obsidian) | Toggles the link under the cursor between wikilink and Markdown | Broader conversion scope: a selection, note, folder or vault to one style |

Last searched for similar plugins on 2026-10-26.

## For plugin developers

This plugin publishes an API, `generateMarkdownLinkExtended()`, through the [`@mnaoumov/obsidian-lib`](https://www.npmjs.com/package/@mnaoumov/obsidian-lib) plugin registry under the id `better-markdown-links`, for a plugin that wants to write the same links without re-implementing them. Copy [`api.d.ts`](./api.d.ts) and [`api-contract.ts`](./api-contract.ts) into your plugin.

Usage, the contract, versioning, and moving over from the pre-6.0.0 `generateMarkdownLink.extended()`: [Plugin API](./docs/plugin-api.md).

## Installation

The plugin is available in [the official Community Plugins repository](https://community.obsidian.md/plugins/better-markdown-links).

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://community.obsidian.md) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://community.obsidian.md/plugins/obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-better-markdown-links).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

By default, debug messages for this plugin (id: `better-markdown-links`) are hidden.

If you need to enable them refer to the [documentation](https://mnaoumov.dev/obsidian-lib/guides/debugging/).

## Changelog

All notable changes to this project will be documented in the [CHANGELOG](./CHANGELOG.md).

## Contributing

Contributions are welcome — see [CONTRIBUTING](./CONTRIBUTING.md) to get set up.

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

### Filing an issue (for AI agents and humans)

Open issues through the [issue forms](https://github.com/mnaoumov/obsidian-better-markdown-links/issues/new/choose), not as blank issues.

To report a bug from inside Obsidian, run the **`Better Markdown Links`: Report a bug** command. It opens the bug form with the plugin version, the Obsidian version and your operating system already filled in.

Filing from the CLI or the API (`gh issue create --body`, or an AI agent filing for you) skips the form, and `gh issue create --template` cannot load an issue form. In that case, open the matching form in [`.github/ISSUE_TEMPLATE/`](https://github.com/mnaoumov/obsidian-better-markdown-links/tree/HEAD/.github/ISSUE_TEMPLATE), copy every field as a `### <label>` heading in the form's order, and fill in each one. Always state the plugin version, the Obsidian version and your operating system.

## License

© [Michael Naumov](https://github.com/mnaoumov/)

[Obsidian]: https://obsidian.md/
