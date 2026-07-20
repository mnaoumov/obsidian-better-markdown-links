[Docs](https://github.com/mnaoumov/obsidian-better-markdown-links/)

# Angle bracket links

Markdown links are more portable than `[[wikilinks]]`, but when a path contains spaces
Obsidian normally percent-encodes them, producing links that are hard to read:

```markdown
[Note with spaces](A%20folder%20with%20spaces/Note%20with%20spaces.md)
```

The Markdown spec allows a far more readable form using **angle brackets**, which Obsidian
understands but does not generate on its own:

```markdown
[Note with spaces](<A folder with spaces/Note with spaces.md>)
```

With **Should use angle brackets** enabled (the default), Better Markdown Links makes Obsidian
generate the angle-bracket form whenever a link is created or converted.

## Try it

1. Open [[03 Convert links]] to see the commands that rewrite existing links.
2. Or type a fresh link to [Note with spaces](<A folder with spaces/Note with spaces.md>) - a
   target whose folder and file name both contain spaces - and watch how it is formatted.
3. Compare it with a link to a space-free target, [Simple note](<Targets/Simple note.md>), where
   angle brackets are not needed.

The link above already uses the angle-bracket form, so it stays readable while still resolving
to the real note.
