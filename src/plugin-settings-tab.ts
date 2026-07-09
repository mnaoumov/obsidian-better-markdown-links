import { appendCodeBlock } from 'obsidian-dev-utils/obsidian/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { PluginSettings } from './plugin-settings.ts';

import { LinkConversionMode } from './link-conversion-mode.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  public override displayLegacy(): void {
    super.displayLegacy();

    new SettingEx(this.containerEl)
      .setName('Should use leading dot for relative paths')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to use a leading dot in relative links.');
        f.createEl('br');
        f.appendText('If enabled: ');
        appendCodeBlock(f, '[[./relative/path/to/target]]');
        f.createEl('br');
        f.appendText('If disabled: ');
        appendCodeBlock(f, '[[relative/path/to/target]]');
      }))
      .addToggle((toggle) => {
        this.bind({ propertyName: 'shouldUseLeadingDotForRelativePaths', valueComponent: toggle });
      });

    new SettingEx(this.containerEl)
      .setName('Should use leading slash for absolute paths')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to use a leading slash in absolute paths.');
        f.createEl('br');
        f.appendText('If enabled: ');
        appendCodeBlock(f, '[[/absolute/path/to/target]]');
        f.createEl('br');
        f.appendText('If disabled: ');
        appendCodeBlock(f, '[[absolute/path/to/target]]');
      }))
      .addToggle((toggle) => {
        this.bind({ propertyName: 'shouldUseLeadingSlashForAbsolutePaths', valueComponent: toggle });
      });

    new SettingEx(this.containerEl)
      .setName('Should use angle brackets')
      .setDesc(createFragment((f) => {
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
      }))
      .addToggle((toggle) => {
        this.bind({ propertyName: 'shouldUseAngleBrackets', valueComponent: toggle });
      });

    new SettingEx(this.containerEl)
      .setName('Convert links')
      .setDesc(createFragment((f) => {
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
      }))
      .addDropdown((dropdown) => {
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

    new SettingEx(this.containerEl)
      .setName('Should automatically update links on rename or move')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to automatically update links when a file is renamed or moved to another directory.');
        f.createEl('br');
        f.appendText('Consider installing the ');
        f.createEl('a', {
          href: 'obsidian://show-plugin?id=backlink-cache',
          text: 'Backlink Cache'
        });
        f.appendText(' plugin to improve performance.');
      }))
      .addToggle((toggle) => {
        this.bind({ propertyName: 'shouldAutomaticallyUpdateLinksOnRenameOrMove', valueComponent: toggle });
      });

    new SettingEx(this.containerEl)
      .setName('Should allow empty embed alias')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to allow empty embed alias. If disabled, empty alias will be replaced with the attachment name.');
        f.createEl('br');
        f.appendText('If enabled: ');
        appendCodeBlock(f, '![](path/to/image.png)');
        f.createEl('br');
        f.appendText('If disabled: ');
        appendCodeBlock(f, '![image](path/to/image.png)');
      }))
      .addToggle((toggle) => {
        this.bind({ propertyName: 'shouldAllowEmptyEmbedAlias', valueComponent: toggle });
      });

    new SettingEx(this.containerEl)
      .setName('Should include attachment extension to embed alias')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to include the extension of the attachment in the embed alias.');
        f.createEl('br');
        f.appendText('If enabled: ');
        appendCodeBlock(f, '![image.png](path/to/image.png)');
        f.createEl('br');
        f.appendText('If disabled: ');
        appendCodeBlock(f, '![image](path/to/image.png)');
      }))
      .addToggle((toggle) => {
        this.bind({ propertyName: 'shouldIncludeAttachmentExtensionToEmbedAlias', valueComponent: toggle });
      });

    new SettingEx(this.containerEl)
      .setName('Should preserve existing link style')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to preserve the existing link style when converting links.');
        f.createEl('br');
        f.appendText('If enabled, the existing link style will be preserved when converting links.');
        f.createEl('br');
        f.appendText('If disabled, the existing links style will be changed to the default link style defined in Obsidian settings.');
      }))
      .addToggle((toggle) => {
        this.bind({ propertyName: 'shouldPreserveExistingLinkStyle', valueComponent: toggle });
      });

    new SettingEx(this.containerEl)
      .setName('Include paths')
      .setDesc(createFragment((f) => {
        f.appendText('Include notes from the following paths');
        f.createEl('br');
        f.appendText('Insert each path on a new line');
        f.createEl('br');
        f.appendText('You can use path string or ');
        appendCodeBlock(f, '/regular expression/');
        f.createEl('br');
        f.appendText('If the setting is empty, all notes are included');
      }))
      .addMultipleText((multipleText) => {
        this.bind({ propertyName: 'includePaths', valueComponent: multipleText });
      });

    new SettingEx(this.containerEl)
      .setName('Exclude paths')
      .setDesc(createFragment((f) => {
        f.appendText('Exclude notes from the following paths');
        f.createEl('br');
        f.appendText('Insert each path on a new line');
        f.createEl('br');
        f.appendText('You can use path string or ');
        appendCodeBlock(f, '/regular expression/');
        f.createEl('br');
        f.appendText('If the setting is empty, no notes are excluded');
      }))
      .addMultipleText((multipleText) => {
        this.bind({
          propertyName: 'excludePaths',
          shouldShowPlaceholderForDefaultValues: false,
          valueComponent: multipleText
        });
      });
  }
}
