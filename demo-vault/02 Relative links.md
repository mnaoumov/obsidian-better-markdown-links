[Docs](https://github.com/mnaoumov/obsidian-better-markdown-links/)

# Relative links

Obsidian can [resolve a relative path as if it were absolute](https://forum.obsidian.md/t/add-settings-to-control-link-resolution-mode/69560),
so the same link behaves differently in Obsidian and in other Markdown editors. Better Markdown
Links fixes this by making relative links explicit.

- **Should use leading dot for relative paths** (default on) prepends `./`, so a relative link
  reads `[Deep note](<./Targets/Nested folder/Deep note.md>)` instead of the ambiguous
  `[Deep note](<Targets/Nested folder/Deep note.md>)`.
- **Should use leading slash for absolute paths** (default on) prepends `/` for vault-absolute
  links, e.g. `[Simple note](</Targets/Simple note.md>)`.

Together these make every generated link unambiguous about whether it is relative to the current
note or to the vault root.

## Try it

These links are written exactly as the plugin generates them - relative, dot-prefixed, and wrapped
in angle brackets where the path has spaces:

- [Deep note](<./Targets/Nested folder/Deep note.md>) - two folders deep, reached with a relative
  path from this note.
- [Simple note](<./Targets/Simple note.md>) - a shallower relative path.
- [Note with spaces](<./A folder with spaces/Note with spaces.md>) - a relative, dot-prefixed,
  angle-bracket link all at once.

Run a convert command from [[03 Convert links]] over an older note to see existing links rewritten
into this form.
