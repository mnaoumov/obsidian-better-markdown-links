# CHANGELOG

## 2.1.0

- Fix invalid race condition updates

# 2.0.0

- Fix race condition for backlinks
- Don't preserve wikilinks if `automaticallyConvertNewLinks`
- Fix links even to non-existing files
- Add support for links without alias

# 1.5.0

- Don't convert links while suggestion is shown

# 1.4.2

- Improve retry logging. Increase timeout to 30 sec

# 1.4.1

- Fix bug with duplicated links

# 1.4.0

- Convert broken links generates by previous version of the plugin
- Proper calculate relative path

# 1.3.0

- Improve warning notice
- Calculate relative path regardless of Obsidian settings

# 1.2.0

- Bugfixes

# 1.1.1

- Update features

# 1.1.0

- Skip if automaticallyConvertNewLinks is not set
- Add automatically convert new links

# 1.0.3

- Encode only special symbols

# 1.0.2

- Refactor editing links

# 1.0.1

- Rewrite createDocumentFragment without innerHTML

# 1.0.0

- Initial implementation