import type { SettingDefinitionItem } from 'obsidian';
import type { PluginSuggestionComponent } from 'obsidian-dev-utils/obsidian/components/plugin-suggestion-component';
import type { PluginSettingsTabBaseConstructorParams } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import { SuggestedPluginState } from 'obsidian-dev-utils/obsidian/components/plugin-suggestion-component';
import { appendCodeBlock } from 'obsidian-dev-utils/obsidian/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

import { LinkConversionMode } from './link-conversion-mode.ts';
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
      // Calls `display()` once `getSettingDefinitions()` is non-empty, so there is no container to write into
      // Otherwise. The row body is emptied first, leaving the Setting element as a bare host for the banner.
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
          f.appendText('Include notes from the following paths');
          f.createEl('br');
          f.appendText('Insert each path on a new line');
          f.createEl('br');
          f.appendText('You can use path string or ');
          appendCodeBlock(f, '/regular expression/');
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
          f.appendText('Insert each path on a new line');
          f.createEl('br');
          f.appendText('You can use path string or ');
          appendCodeBlock(f, '/regular expression/');
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
      })
    ];
  }
}
