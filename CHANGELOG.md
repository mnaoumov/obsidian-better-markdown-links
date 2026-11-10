# CHANGELOG

## 6.5.0

This release has 2 new features and 2 documentation changes. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- resolve links strictly relative to their note
- `GitHub` heading anchors, emitted and resolved

### Documentation

- make issue attachments optional and strongly encouraged
- link to the Obsidian resources page

## 6.4.0

This release has 2 new features and 3 documentation changes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- add a Report a bug command
- record folder and vault command runs as `git` commits that a revert undoes

### Documentation

- **readme:** point bug reports at the Report a bug command
- add issue-filing instructions for AI agents
- **settings:** say what a markdown link in a property still lacks since Obsidian 1.11

## 6.3.1

This release has 1 fix.

### Fixed

- stop file-link normalization wrapping bare file: words and code-fence labels

## 6.3.0

This release has 1 new feature. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- \[FR\] Exclude links by target path or extension from conversion (#45)

## 6.2.3

This release has 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- \[BUG\] Converting a note rewrites a wikilink inside a heading, changing the heading's text and breaking links to it (#44)

## 6.2.2

This release has 1 fix and 3 documentation changes. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- \[BUG\] Converting a link to a heading containing < or > produces a link that no longer parses (#43)

### Documentation

- **readme:** combine related resources and plugin comparisons
- **readme:** cut the README to a landing page
- **readme:** add a Similar plugins section

## 6.2.1

This release has 2 fixes and 6 documentation changes. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- drop the plugin name from notice text
- **demo-vault:** load the demo setup helpers from @mnaoumov/obsidian-lib

### Documentation

- name `obsidian-lib` where comments said dev-utils
- point leftover `obsidian-dev-utils` mentions at @mnaoumov/obsidian-lib
- shorten the debugging section
- **changelog:** escape the issue-title tags so `markdownlint` and `cspell` pass
- **changelog:** name the issue each released entry resolved
- **readme:** lead the Debugging section with `Advanced Debug Mode`

## 6.2.0

This release has 1 new feature and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- **settings:** merge matching include and exclude paths case-insensitively with globs

### Documentation

- mark plugin names as code

## 6.1.0

This release has 3 new features, 1 fix and 5 documentation changes. 9 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **ui:** merge rendering plugin names in the suggestion reason and progress bar titles as code
- **api:** merge taking `Advanced Rename and Delete Handler`'s own migration contract
- **api:** merge the copyable api-contract.ts with full schemas

### Fixed

- **links:** merge keeping wikilinks in properties when converting to markdown

### Documentation

- **api-contract:** refresh the copied `Advanced Rename and Delete Handler` debug-switch line
- **api-contract:** merge saying the payload check follows `obsidian-lib`'s validation debug switch
- **demo-vault:** merge the fresh-link buttons for the angle-bracket and relative-links notes
- merge marking plugin names as code in markdown and comments
- **changelog:** name the API method that replaces generateMarkdownLink.extended

## 6.0.0

- feat!: merge the plugin API that replaces generateMarkdownLink.extended
  - BREAKING: `app.fileManager.generateMarkdownLink.extended()` is removed. Call `generateMarkdownLinkExtended()` on the `better-markdown-links` plugin API (contract `^1`) instead; it takes the same options. See [For plugin developers](./README.md#for-plugin-developers).

## 5.2.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 5.2.0

This release has maintenance changes only. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 5.1.0

This release has 2 new features, 5 fixes, 1 improvement and 3 documentation changes. 9 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **commands:** merge the selection scope for every link command
- add a forced link path style and a convert-paths-to-relative command triad

### Fixed

- **test:** merge the headless demo-vault toolkit install
- **deps:** restore the lockfile's missing resolved and integrity fields
- leave an alias-only wikilink alone when several notes answer to the name
- stop the on-save probe flushing the editor, which blanked another plugin's inserted properties (re #40 - \[BUG\] Conflict with Linter Save (Ctrl+S))
- **deps:** float devalue to 5.9.4, clearing GHSA-9rgm-9g3h-6x36

### Improved

- answer the alias lookup from the name index when one is installed

### Documentation

- replace the private rule-id citations with what they assert
- **changelog:** name `obsidian-dev-utils` by its package name
- replace the private tracker references with what they pointed at

## 5.0.1

This release has 2 new features, 1 fix and 3 documentation changes. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- force Markdown links, as a style setting and its own command triad
- demote embeds to links, and resolve wikilinks that do not resolve

### Fixed

- **deps:** move onto `obsidian-dev-utils` 101, and drop the hand-rolled app.plugins seed

### Documentation

- say where the debug command is run
- name the unversioned demo-vault asset and the folder it unzips into
- rename the file:// example path off the word "todo"

## 5.0.0

This release has 1 breaking change and 1 fix.

### Breaking changes

- hand rename/delete over to `Advanced Rename and Delete Handler`

### Fixed

- **build:** wire build:compile to buildCompile and drop the duplicate leaf script

## 4.2.5

This release has 2 fixes and 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- **deps:** move to `obsidian-integration-testing` 11 and `obsidian-dev-utils` 96.5.2
- **deps:** drop the brace-expansion file: override that breaks a clean install

### Documentation

- point plugin-directory links at community.obsidian.md

## 4.2.4

This release has 1 fix and 4 documentation changes. 6 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- override deepmerge-ts to clear GHSA-ggr8-5vv4-36mx

### Documentation

- **demo-vault:** unwrap the notes so Obsidian stops rendering a break per line
- **readme:** render the same in Obsidian's plugin page as on `GitHub`
- **demo-vault:** give the demo vault its code buttons
- capture the community-store screenshot set

## 4.2.3

This release has 1 new feature and 1 documentation change.

### New

- **demo-vault:** migrate to `obsidian-dev-utils` 93.3.1 and adopt the authoring convention

### Documentation

- make the demo vault the documentation, in the standard layout

## 4.2.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 4.2.1

This release has maintenance changes only. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 4.2.0

This release has 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Documentation

- fix the demo vault download instructions

## 4.1.6

This release has 1 fix.

### Fixed

- pass plugin notice component to link update operations

## 4.1.5

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 4.1.4

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 4.1.3

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 4.1.2

This release has 1 fix. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **demo-vault:** export invoke() from startup script; add Invocables folder

## 4.1.1

This release has 6 documentation changes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Documentation

- standardize demo-vault README
- drop per-plugin demo-vault setup notes (bootstrap covered by the `obsidian-dev-utils` harness)
- unnumber demo-vault setup notes
- **demo-vault:** create the `Better Markdown Links` demo vault
- update
- migrate to AGENTS.md

## 4.1.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- \[FR\] Support file:/// links (#35)

## 4.0.0

This release has 1 new feature.

### New

- \[FR\] Convert on save (#36)

## 3.4.13

This release has 1 fix. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- apply shouldAllowEmptyEmbedAlias setting to generateMarkdownLink

## 3.4.12

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.4.11

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 3.4.10

This release has 1 fix. 4 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- prevent command-handler stack overflow from redundant super calls

## 3.4.9

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 3.4.8

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.4.7

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.4.6

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.4.5

This release has 1 breaking change. 16 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- migrate to `obsidian-dev-utils` v2 component architecture

## 3.4.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.4.3

- resubmit

## 3.4.2

- resubmit

## 3.4.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.4.0

This release has 1 new feature and 2 fixes. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- add to submenu

### Fixed

- remove link update hack
- changed api re #33

## 3.3.1

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.3.0

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.2.4

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.2.3

This release has 1 new feature.

### New

- show default value for excluded paths

## 3.2.2

- fix: exclude excalidraw/tldraw files by default
  - re <https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2594>
  - re <https://github.com/tldraw-in-obsidian/tldraw-in-obsidian/issues/186>

## 3.2.1

This release has 1 fix. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Fixed

- suggestion detection in another window re #25

## 3.2.0

This release has 1 new feature. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### New

- ensure links created on click are converted re #31

## 3.1.14

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.13

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.12

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.11

This release has 1 fix.

### Fixed

- handling include/exclude paths not ending with /

## 3.1.10

This release has 1 fix. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- swallow silent error

## 3.1.9

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.8

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.7

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.6

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.5

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 3.1.4

This release has maintenance changes only. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

## 3.1.3

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.2

This release has maintenance changes only. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

## 3.1.1

This release has 1 documentation change.

### Documentation

- fix example typo

## 3.1.0

This release has 1 new feature.

### New

- improve docs

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

This release has 1 other change.

### Other changes

- Update libs (#22)

## 2.13.9

This release has 2 other changes.

### Other changes

- Update libs (#22)
- Update types

## 2.13.8

- Minor changes

## 2.13.7

This release has 1 other change.

### Other changes

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

This release has 3 other changes.

### Other changes

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

This release has 1 other change.

### Other changes

- Pass plugin's abortSignal

## 2.12.0

This release has 1 other change.

### Other changes

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

This release has 1 other change.

### Other changes

- New template

## 2.11.0

This release has 1 other change.

### Other changes

- Show progress bar

## 2.10.19

- Minor changes

## 2.10.18

- Minor changes

## 2.10.17

This release has 2 other changes.

### Other changes

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

This release has 1 other change.

### Other changes

- Refactor

## 2.10.11

- Minor changes

## 2.10.10

This release has 1 other change.

### Other changes

- Lint

## 2.10.9

This release has 1 other change.

### Other changes

- format

## 2.10.8

- Minor changes

## 2.10.7

This release has 1 other change.

### Other changes

- Refactor

## 2.10.6

- Minor changes

## 2.10.5

- Minor changes

## 2.10.4

This release has 1 other change.

### Other changes

- Exclude empty paths

## 2.10.3

- Minor changes

## 2.10.2

- Minor changes

## 2.10.1

- Minor changes

## 2.10.0

This release has 1 other change.

### Other changes

- Add include/exclude path settings

## 2.9.15

- Minor changes

## 2.9.14

- Minor changes

## 2.9.13

This release has 1 other change.

### Other changes

- Refactor to loop

## 2.9.12

- Minor changes

## 2.9.11

- Minor changes

## 2.9.10

This release has 1 other change.

### Other changes

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

This release has 1 other change.

### Other changes

- Refactor

## 2.7.0

This release has 1 other change.

### Other changes

- Stop race condition

## 2.6.0

This release has 2 other changes.

### Other changes

- Add more settings
- Fix race condition

## 2.5.0

This release has 1 other change.

### Other changes

- Refactor generateMarkdownLink

## 2.4.0

- Fix mobile build

## 2.3.0

- Switch to `obsidian-dev-utils`
- Refactor generateMarkdownLink

## 2.2.0

- Fix race condition

## 2.1.0

This release has 1 other change.

### Other changes

- Fix invalid race condition updates

## 2.0.0

This release has 4 other changes.

### Other changes

- Fix race condition for backlinks
- Don't preserve wikilinks if automaticallyConvertNewLinks
- Fix links even to non-existing files
- Add support for links without alias

## 1.5.0

This release has 1 other change.

### Other changes

- Don't convert links while suggestion is shown

## 1.4.2

This release has 1 other change.

### Other changes

- Improve retry logging. Increase timeout to 30 sec

## 1.4.1

This release has 1 other change.

### Other changes

- Fix bug with duplicated links

## 1.4.0

This release has 2 other changes.

### Other changes

- Convert broken links generates by previous version of the plugin
- Proper calculate relative path

## 1.3.0

This release has 2 other changes.

### Other changes

- Improve warning notice
- Calculate relative path regardless of Obsidian settings

## 1.2.0

- Bugfixes

## 1.1.1

This release has 1 other change.

### Other changes

- Update features

## 1.1.0

This release has 2 other changes.

### Other changes

- Skip if automaticallyConvertNewLinks is not set
- Add automatically convert new links

## 1.0.3

This release has 1 other change.

### Other changes

- Encode only special symbols

## 1.0.2

This release has 1 other change.

### Other changes

- Refactor editing links

## 1.0.1

This release has 1 other change.

### Other changes

- Rewrite createDocumentFragment without innerHTML

## 1.0.0

This release has 1 other change.

### Other changes

- Initial implementation
