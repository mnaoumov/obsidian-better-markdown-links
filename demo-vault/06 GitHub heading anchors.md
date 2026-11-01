# GitHub heading anchors

Obsidian and GitHub disagree about how a link reaches a heading. Obsidian matches the heading's text, so it writes `[Upgrading](<Guide.md#Upgrading>)`. GitHub gives every heading an anchor of its own - lowercased, punctuation dropped, spaces turned into hyphens, and `-1`, `-2` added to a repeated one - so it expects `[Upgrading](Guide.md#upgrading)`. A vault published to GitHub therefore loses its heading links, and a note copied in from GitHub loses its links in Obsidian.

`Better Markdown Links` closes the gap from both ends:

- **Should resolve GitHub heading anchors** (default on) makes Obsidian follow, embed and preview a link whose heading part is a GitHub anchor, whenever Obsidian itself finds no heading by that text.
- **Should use GitHub heading anchors** (default off) writes the anchor whenever the plugin writes a markdown link to a heading: a link you type, and every conversion. Wikilinks keep Obsidian's own form, since GitHub does not render them anyway.

## Try it

These links are written the GitHub way. Click them, or hover over them, and Obsidian lands on the right heading - the second one is the second `### Options`, which only its anchor tells apart from the first:

- [Installation](<./Materials/06 GitHub heading anchors/Guide.md#installation>)
- [The options an upgrade adds](<./Materials/06 GitHub heading anchors/Guide.md#options-1>)

An embed of an anchor, such as `![[Guide#options-1]]`, shows that same section.

To see the plugin write such links itself, this button turns on **Should use GitHub heading anchors**, sets **Link style** to **Markdown** (this vault otherwise follows Obsidian's **Use `[[Wikilinks]]`**, which is on by default), and writes a note holding a fresh link to each heading of the guide, generated exactly the way Obsidian generates the link you type:

```code-button
---
caption: Write heading links as GitHub anchors
---
await require('/demoSetup.ts').writeHeadingAnchorLinks(app);
```

Manual equivalent: set **Link style** to **Markdown** and turn on **Should use GitHub heading anchors** in **Settings -> Community plugins -> `Better Markdown Links`**, then type `[[Guide#` in any note and pick a heading.

To rewrite the heading links a note already has, run **Convert links in current file** from [03 Convert links](<./03 Convert links.md>) with the setting on.

```code-button
---
caption: Turn GitHub heading anchors back off
---
await require('/demoSetup.ts').changeSettings(app, { linkStyleMode: 'ObsidianSettingsDefault', shouldUseGitHubHeadingAnchors: false });
```

Manual equivalent: set **Link style** back to **Obsidian settings default** and turn **Should use GitHub heading anchors** off.
