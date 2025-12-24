# CHANGELOG

## 3.2.1

- chore: update libs
- fix: suggestion detection in another window re #25

## 3.2.0

- feat: ensure links created on click are converted re #31
- chore: update libs

## 3.1.14

- chore: update libs

## 3.1.13

- chore: update libs

## 3.1.12

- chore: update libs

## 3.1.11

- fix: handling include/exclude paths not ending with /

## 3.1.10

- chore: format
- chore: update libs
- fix: swallow silent error
- chore: update libs

## 3.1.9

- chore: update libs

## 3.1.8

- chore: update libs

## 3.1.7

- chore: update libs

## 3.1.6

- chore: update libs

## 3.1.5

- chore: update libs
- chore: enable markdownlint

## 3.1.4

- refactor: remove unused
- chore: update libs

## 3.1.3

- chore: reorder commands

## 3.1.2

- chore: clean empty hook

## 3.1.1

- docs: fix example typo

## 3.1.0

- feat: improve docs

## 3.0.0

- refactor: switch to commands
- fix: register default settings
- chore: update libs
- chore: lint
- chore: update libs
- refactor: copy recent implementation from `obsidian-dev-utils`
- refactor: extract GenerateMarkdownLinkExtended
- fix: remove mention of compatibility setting
- chore: update libs
- feat: stop overriding Obsidian settings
  - Now the plugin generates the links according to the current Obsidian settings and does not try override them. Also the warning about incompatible settings is no longer shown
  - BREAKING CHANGE: It is no longer possible to override the Obsidian settings behavior with the plugin. You need to modify Obsidian settings accordingly.
- feat: add config setting shouldUseLeadingSlashForAbsolutePath
  - fix #23
- fix: compilation
- chore: add commit script
- chore: update libs
- chore: enable conventional commits

## 2.13.19

- Minor changes

## 2.13.18

- Minor changes

## 2.13.17

- Minor changes

## 2.13.16

- Minor changes

## 2.13.15

- Minor changes

## 2.13.14

- Minor changes

## 2.13.13

- Minor changes

## 2.13.12

- Minor changes

## 2.13.11

- Minor changes

## 2.13.10

- Update libs (#22)

## 2.13.9

- Update libs (#22)
- Update types

## 2.13.8

- Minor changes

## 2.13.7

- Improve error handling (#21)

## 2.13.6

- Minor changes

## 2.13.5

- Minor changes

## 2.13.4

- Minor changes

## 2.13.3

- Fix #21

## 2.13.2

- Minor changes

## 2.13.1

- Minor changes

## 2.13.0

- shouldPreserveExistingLinkStyle
- Increase include/exclude settings
- Prevent conflicting updates

## 2.12.4

- Minor changes

## 2.12.3

- Minor changes

## 2.12.2

- Minor changes

## 2.12.1

- Pass plugin's abortSignal

## 2.12.0

- Pass abortSignal

## 2.11.20

- Minor changes

## 2.11.19

- Minor changes

## 2.11.18

- Minor changes

## 2.11.17

- Minor changes

## 2.11.16

- Minor changes

## 2.11.15

- Minor changes

## 2.11.14

- Fix #19

## 2.11.13

- Minor changes

## 2.11.12

- Fix #17

## 2.11.11

- Minor changes

## 2.11.10

- Minor changes

## 2.11.9

- Minor changes

## 2.11.8

- Minor changes

## 2.11.7

- Minor changes

## 2.11.6

- Improve performance

## 2.11.5

- Minor changes

## 2.11.4

- Minor changes

## 2.11.3

- Minor changes

## 2.11.2

- Minor changes

## 2.11.1

- New template

## 2.11.0

- Show progress bar

## 2.10.19

- Minor changes

## 2.10.18

- Minor changes

## 2.10.17

- Fix build
- Explicit typescript package

## 2.10.16

- Minor changes

## 2.10.15

- Minor changes

## 2.10.14

- Minor changes

## 2.10.13

- Minor changes

## 2.10.12

- Refactor

## 2.10.11

- Minor changes

## 2.10.10

- Lint

## 2.10.9

- format

## 2.10.8

- Minor changes

## 2.10.7

- Refactor

## 2.10.6

- Minor changes

## 2.10.5

- Minor changes

## 2.10.4

- Exclude empty paths

## 2.10.3

- Minor changes

## 2.10.2

- Minor changes

## 2.10.1

- Minor changes

## 2.10.0

- Add include/exclude path settings

## 2.9.15

- Minor changes

## 2.9.14

- Minor changes

## 2.9.13

- Refactor to loop

## 2.9.12

- Minor changes

## 2.9.11

- Minor changes

## 2.9.10

- Avoid default exports

## 2.9.9

- Minor changes

## 2.9.8

- Minor changes

## 2.9.7

- Minor changes

## 2.9.6

- Minor changes

## 2.9.5

- Minor changes

## 2.9.4

- Minor changes

## 2.9.3

- Minor changes

## 2.9.2

- Minor changes

## 2.9.1

- Minor changes

## 2.9.0

- Minor changes

## 2.8.0

- Fix unnecessary extra alias

## 2.7.1

- Refactor

## 2.7.0

- Stop race condition

## 2.6.0

- Add more settings
- Fix race condition

## 2.5.0

- Refactor generateMarkdownLink

## 2.4.0

- Fix mobile build

## 2.3.0

- Switch to obsidian-dev-utils
- Refactor generateMarkdownLink

## 2.2.0

- Fix race condition

## 2.1.0

- Fix invalid race condition updates

## 2.0.0

- Fix race condition for backlinks
- Don't preserve wikilinks if `automaticallyConvertNewLinks`
- Fix links even to non-existing files
- Add support for links without alias

## 1.5.0

- Don't convert links while suggestion is shown

## 1.4.2

- Improve retry logging. Increase timeout to 30 sec

## 1.4.1

- Fix bug with duplicated links

## 1.4.0

- Convert broken links generates by previous version of the plugin
- Proper calculate relative path

## 1.3.0

- Improve warning notice
- Calculate relative path regardless of Obsidian settings

## 1.2.0

- Bugfixes

## 1.1.1

- Update features

## 1.1.0

- Skip if automaticallyConvertNewLinks is not set
- Add automatically convert new links

## 1.0.3

- Encode only special symbols

## 1.0.2

- Refactor editing links

## 1.0.1

- Rewrite createDocumentFragment without innerHTML

## 1.0.0

- Initial implementation
