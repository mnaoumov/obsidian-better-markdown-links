import type { PluginSuggestionComponent } from '@mnaoumov/obsidian-lib/components/plugin-suggestion-component';
import type { PluginSettingsTabBaseConstructorParams } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';
import type { SettingDefinitionItem } from 'obsidian';

import { SuggestedPluginState } from '@mnaoumov/obsidian-lib/components/plugin-suggestion-component';
import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';
import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';
import { Platform } from 'obsidian';

import type { PluginSettings } from './plugin-settings.ts';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { LinkPathStyleMode } from './link-path-style-mode.ts';
import { LinkStyleMode } from './link-style-mode.ts';

interface PluginSettingsTabConstructorParams extends PluginSettingsTabBaseConstructorParams<PluginSettings> {
  readonly pluginSuggestionComponent: PluginSuggestionComponent;
}

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  private readonly pluginSuggestionComponent: PluginSuggestionComponent;

  public constructor(params: PluginSettingsTabConstructorParams) {
    super(params);
    this.pluginSuggestionComponent = params.pluginSuggestionComponent;
  }

  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      // The suggestion banner has to travel as a row: Obsidian renders the declarative definitions and never
      // calls `display()` once `getSettingDefinitions()` is non-empty, so there is no container to write into
      // otherwise. The row body is emptied first, leaving the Setting element as a bare host for the banner.
      this.settingEx({
        name: '',
        render: (setting) => {
          setting.settingEl.empty();
          this.pluginSuggestionComponent.renderBanner(setting.settingEl);
        },
        searchable: false,
        visible: () => this.pluginSuggestionComponent.getSuggestedPluginState() !== SuggestedPluginState.Enabled
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to use a leading dot in relative links.');
          f.createEl('br');
          f.appendText('If enabled: ');
          appendCodeBlock(f, '[[./relative/path/to/target]]');
          f.createEl('br');
          f.appendText('If disabled: ');
          appendCodeBlock(f, '[[relative/path/to/target]]');
        }),
        name: 'Should use leading dot for relative paths',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldUseLeadingDotForRelativePaths', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to use a leading slash in absolute paths.');
          f.createEl('br');
          f.appendText('If enabled: ');
          appendCodeBlock(f, '[[/absolute/path/to/target]]');
          f.createEl('br');
          f.appendText('If disabled: ');
          appendCodeBlock(f, '[[absolute/path/to/target]]');
        }),
        name: 'Should use leading slash for absolute paths',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldUseLeadingSlashForAbsolutePaths', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to use angle brackets in links. Applicable only if ');
          f.createEl('br');
          appendCodeBlock(f, 'Use [[Wikilinks]]');
          f.appendText(' Obsidian setting is disabled.');
          f.createEl('br');
          f.appendText('If enabled: ');
          appendCodeBlock(f, '[alias](<path with spaces.md>)');
          f.createEl('br');
          f.appendText('If disabled: ');
          appendCodeBlock(f, '[alias](path%20with%20spaces.md)');
        }),
        name: 'Should use angle brackets',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldUseAngleBrackets', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to normalize ');
          appendCodeBlock(f, 'file://');
          f.appendText(' links to a pretty form (converting backslashes to forward slashes) when converting links.');
          f.createEl('br');
          f.appendText('If enabled: ');
          appendCodeBlock(f, '[alias](<file:///C:/path/to/file.md>)');
          f.createEl('br');
          f.appendText('If disabled, ');
          appendCodeBlock(f, 'file://');
          f.appendText(' links are left unchanged.');
        }),
        name: 'Should normalize file links',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldNormalizeFileLinks', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('When to automatically convert links to the selected format.');
          f.createEl('br');
          f.appendText('Each option is cumulative and also includes every option above it.');
          f.createEl('br');
          appendCodeBlock(f, 'On explicit command');
          f.appendText(' - only when a convert command is invoked. No automatic conversion happens.');
          f.createEl('br');
          appendCodeBlock(f, 'On save command');
          f.appendText(' - additionally when the ');
          appendCodeBlock(f, 'Save current file');
          f.appendText(' command runs (usually bound to ');
          appendCodeBlock(f, 'Ctrl + S');
          f.appendText(').');
          f.createEl('br');
          appendCodeBlock(f, 'On auto save');
          f.appendText(' - additionally on the implicit auto-save (usually every 2s).');
          f.createEl('br');
          appendCodeBlock(f, 'On every modification');
          f.appendText(' - additionally on every file modification, including changes made outside Obsidian.');
        }),
        name: 'Convert links',
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            dropdown.addOptions({
              /* eslint-disable perfectionist/sort-objects -- Need to keep order. */
              [LinkConversionMode.OnExplicitCommand]: 'On explicit command',
              [LinkConversionMode.OnSaveCommand]: 'On save command',
              [LinkConversionMode.OnAutoSave]: 'On auto save',
              [LinkConversionMode.OnEveryModification]: 'On every modification'
              /* eslint-enable perfectionist/sort-objects -- Need to keep order. */
            });
            this.bind({ propertyName: 'linkConversionMode', valueComponent: dropdown });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to allow empty embed alias. If disabled, empty alias will be replaced with the attachment name.');
          f.createEl('br');
          f.appendText('If enabled: ');
          appendCodeBlock(f, '![](path/to/image.png)');
          f.createEl('br');
          f.appendText('If disabled: ');
          appendCodeBlock(f, '![image](path/to/image.png)');
        }),
        name: 'Should allow empty embed alias',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldAllowEmptyEmbedAlias', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to include the extension of the attachment in the embed alias.');
          f.createEl('br');
          f.appendText('If enabled: ');
          appendCodeBlock(f, '![image.png](path/to/image.png)');
          f.createEl('br');
          f.appendText('If disabled: ');
          appendCodeBlock(f, '![image](path/to/image.png)');
        }),
        name: 'Should include attachment extension to embed alias',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldIncludeAttachmentExtensionToEmbedAlias', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Which link style to write.');
          f.createEl('br');
          appendCodeBlock(f, 'Preserve existing');
          f.appendText(' - keep each link\'s existing wikilink-vs-markdown style when converting it.');
          f.createEl('br');
          appendCodeBlock(f, 'Obsidian settings default');
          f.appendText(' - follow the ');
          appendCodeBlock(f, 'Use [[Wikilinks]]');
          f.appendText(' Obsidian setting.');
          f.createEl('br');
          appendCodeBlock(f, 'Markdown');
          f.appendText(' - always write ');
          appendCodeBlock(f, '[alias](path/to/target.md)');
          f.appendText(', whatever that Obsidian setting says. Applies to links this plugin generates and to embeds being demoted, not only to links being converted.');
        }),
        name: 'Link style',
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            dropdown.addOptions({
              /* eslint-disable perfectionist/sort-objects -- Need to keep order. */
              [LinkStyleMode.PreserveExisting]: 'Preserve existing',
              [LinkStyleMode.ObsidianSettingsDefault]: 'Obsidian settings default',
              [LinkStyleMode.Markdown]: 'Markdown'
              /* eslint-enable perfectionist/sort-objects -- Need to keep order. */
            });
            this.bind({ propertyName: 'linkStyleMode', valueComponent: dropdown });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether a wikilink in a note\'s properties, such as ');
          appendCodeBlock(f, 'base: "[[table.base]]"');
          f.appendText(', is converted to a markdown link like the links in the note\'s body.');
          f.createEl('br');
          f.appendText('Obsidian treats a property value as a link only when it is a wikilink, so a markdown link there is plain text: the property stops linking, and a Bases item whose property was converted drops out of its table.');
          f.createEl('br');
          f.appendText('Enable it only if another plugin makes markdown links work in properties, such as ');
          appendCodeBlock(f, 'Frontmatter Markdown Links');
          f.appendText('. Either way, a property wikilink\'s path style is still converted.');
        }),
        name: 'Should convert frontmatter wikilinks to markdown',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldConvertFrontmatterWikilinksToMarkdown', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Which link path style to write.');
          f.createEl('br');
          appendCodeBlock(f, 'Obsidian settings default');
          f.appendText(' - follow the ');
          appendCodeBlock(f, 'New link format');
          f.appendText(' Obsidian setting.');
          f.createEl('br');
          appendCodeBlock(f, 'Relative path to the source');
          f.appendText(' - always write the path relative to the note the link is in, e.g. ');
          appendCodeBlock(f, '[alias](<./folder/target.md>)');
          f.appendText('.');
          f.createEl('br');
          appendCodeBlock(f, 'Shortest path when possible');
          f.appendText(' - always write the shortest path that still resolves to a single note, e.g. ');
          appendCodeBlock(f, '[alias](<target.md>)');
          f.appendText('.');
          f.createEl('br');
          appendCodeBlock(f, 'Absolute path in vault');
          f.appendText(' - always write the path from the vault root, e.g. ');
          appendCodeBlock(f, '[alias](</folder/target.md>)');
          f.appendText('.');
          f.createEl('br');
          f.appendText('Outside the default, the two leading dot and slash settings above are applied as written rather than copied from the link being replaced.');
        }),
        name: 'Link path style',
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            dropdown.addOptions({
              /* eslint-disable perfectionist/sort-objects -- Need to keep order. */
              [LinkPathStyleMode.ObsidianSettingsDefault]: 'Obsidian settings default',
              [LinkPathStyleMode.RelativePathToTheSource]: 'Relative path to the source',
              [LinkPathStyleMode.ShortestPathWhenPossible]: 'Shortest path when possible',
              [LinkPathStyleMode.AbsolutePathInVault]: 'Absolute path in vault'
              /* eslint-enable perfectionist/sort-objects -- Need to keep order. */
            });
            this.bind({ propertyName: 'linkPathStyleMode', valueComponent: dropdown });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to append the target file name as a sub-bullet when demoting an embed to a link.');
          f.createEl('br');
          f.appendText('If enabled: ');
          appendCodeBlock(f, '[alias](path/to/image.png)');
          f.appendText(' followed by a ');
          appendCodeBlock(f, '- image.png');
          f.appendText(' sub-bullet.');
          f.createEl('br');
          f.appendText('If disabled: ');
          appendCodeBlock(f, '[alias](path/to/image.png)');
        }),
        name: 'Should append file name when demoting embeds',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldAppendFileNameWhenDemotingEmbeds', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to look an unresolved wikilink up against every note\'s ');
          appendCodeBlock(f, 'aliases');
          f.appendText(' frontmatter and basename before converting it.');
          f.createEl('br');
          f.appendText('A markdown link cannot carry an alias the way ');
          appendCodeBlock(f, '[[Some Alias]]');
          f.appendText(' does, so without this an alias-only wikilink converts into a link pointing at a note that does not exist.');
          f.createEl('br');
          f.appendText('Only an unambiguous answer is written. When several notes carry the same name the link is left exactly as it is, unresolved, because there is no right answer to pick — and no note is created for it either.');
          f.createEl('br');
          f.appendText('Off by default because the lookup also matches by file name, and a wikilink only reaches it once Obsidian itself has failed to resolve it: a file-name match here is one Obsidian refused, found only through this plugin\'s laxer casing and spacing rules.');
          f.createEl('br');
          f.appendText('Applies only to the explicit convert commands, never to automatic conversion.');
        }),
        name: 'Should resolve links via aliases',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldResolveLinksViaAliases', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to create the note when a wikilink still does not resolve after the alias lookup.');
          f.createEl('br');
          f.appendText('A name several notes already carry is not a missing note, so nothing is created for it.');
          f.createEl('br');
          f.appendText('This writes new files to your vault, in the folder your ');
          appendCodeBlock(f, 'Default location for new notes');
          f.appendText(' Obsidian setting names.');
          f.createEl('br');
          f.appendText('Applies only to the explicit convert commands, never to automatic conversion.');
        }),
        name: 'Should create missing notes',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldCreateMissingNotes', valueComponent: toggle });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to record each in-folder and entire-vault command run as git commits, when the vault is inside a git repository.');
          f.createEl('br');
          f.appendText('Whatever was pending is committed first as ');
          appendCodeBlock(f, 'chore: before OP<n>');
          f.appendText(', then the run\'s own changes as ');
          appendCodeBlock(f, 'OP<n>: <command> in <folder>');
          f.appendText('.');
          f.createEl('br');
          f.appendText('The ');
          appendCodeBlock(f, 'Undo a bulk operation...');
          f.appendText(' command reverts one of those commits. Desktop only; uses the system ');
          appendCodeBlock(f, 'git');
          f.appendText('.');
        }),
        name: 'Should commit bulk operations',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({ propertyName: 'shouldCommitBulkOperations', valueComponent: toggle });
          });
        },
        visible: () => Platform.isDesktop
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Include notes from the following paths');
          f.createEl('br');
          appendPathEntryVocabulary(f);
          f.createEl('br');
          f.appendText('If the setting is empty, all notes are included');
        }),
        name: 'Include paths',
        render: (setting) => {
          setting.addMultipleText((multipleText) => {
            this.bind({ propertyName: 'includePaths', valueComponent: multipleText });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Exclude notes from the following paths');
          f.createEl('br');
          appendPathEntryVocabulary(f);
          f.createEl('br');
          f.appendText('If the setting is empty, no notes are excluded');
        }),
        name: 'Exclude paths',
        render: (setting) => {
          setting.addMultipleText((multipleText) => {
            this.bind({
              propertyName: 'excludePaths',
              shouldShowPlaceholderForDefaultValues: false,
              valueComponent: multipleText
            });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Leave links whose target matches the following paths exactly as written');
          f.createEl('br');
          f.appendText('They are not converted, restyled, normalized, demoted or resolved; every other link in the note still is');
          f.createEl('br');
          f.appendText('For example, ');
          appendCodeBlock(f, '*.base');
          f.appendText(' keeps ');
          appendCodeBlock(f, '![[file.base]]');
          f.appendText(' embeds for a publisher that reads only the wikilink form');
          f.createEl('br');
          f.appendText('The target is the file the link resolves to, or for an unresolved link the path it names');
          f.createEl('br');
          appendPathEntryVocabulary(f);
          f.createEl('br');
          f.appendText('If the setting is empty, no links are excluded');
        }),
        name: 'Exclude link target paths',
        render: (setting) => {
          setting.addMultipleText((multipleText) => {
            this.bind({ propertyName: 'excludeLinkTargetPaths', valueComponent: multipleText });
          });
        }
      })
    ];
  }
}

// The entry syntax is obsidian-lib's `PathSettings`, so every path setting describes it in the same words.
function appendPathEntryVocabulary(f: DocumentFragment): void {
  f.appendText('Insert each entry on a new line');
  f.createEl('br');
  f.appendText('An entry is a path (');
  appendCodeBlock(f, 'Notes/Daily');
  f.appendText('), a glob (');
  appendCodeBlock(f, '*.pdf');
  f.appendText(', ');
  appendCodeBlock(f, 'Notes/**/*.md');
  f.appendText(', ');
  appendCodeBlock(f, 'tmp*/');
  f.appendText(') or a ');
  appendCodeBlock(f, '/regular expression/flags');
  f.createEl('br');
  f.appendText('A glob without ');
  appendCodeBlock(f, '/');
  f.appendText(' matches a name at any depth, and a trailing ');
  appendCodeBlock(f, '/');
  f.appendText(' matches folders only');
  f.createEl('br');
  f.appendText('Matching ignores case. Escape a literal ');
  appendCodeBlock(f, '*');
  f.appendText(', ');
  appendCodeBlock(f, '?');
  f.appendText(' or ');
  appendCodeBlock(f, '[');
  f.appendText(' in a path with ');
  appendCodeBlock(f, '\\');
}
