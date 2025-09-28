import { appendCodeBlock } from 'obsidian-dev-utils/HTMLElement';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { SettingEx } from 'obsidian-dev-utils/obsidian/SettingEx';

import type { PluginTypes } from './PluginTypes.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    new SettingEx(this.containerEl)
      .setName('Should use leading dot')
      .setDesc('Whether to use a leading dot in relative links.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldUseLeadingDot');
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
        this.bind(toggle, 'shouldUseLeadingSlashForAbsolutePaths');
      });

    new SettingEx(this.containerEl)
      .setName('Should use angle brackets')
      .setDesc('Whether to use angle brackets in links.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldUseAngleBrackets');
      });

    new SettingEx(this.containerEl)
      .setName('Should automatically convert new links')
      .setDesc('Whether to automatically convert new links entered manually to the selected format.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldAutomaticallyConvertNewLinks');
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
        this.bind(toggle, 'shouldAutomaticallyUpdateLinksOnRenameOrMove');
      });

    new SettingEx(this.containerEl)
      .setName('Should ignore incompatible Obsidian settings')
      .setDesc(createFragment((f) => {
        f.appendText('Current plugin makes sense only if you have ');
        appendCodeBlock(f, 'Use [[Wikilinks]]');
        f.appendText(' disabled and ');
        appendCodeBlock(f, 'New link format');
        f.appendText(' set to ');
        appendCodeBlock(f, 'Relative path to file');
        f.appendText(' in Obsidian settings.');
        f.createEl('br');
        f.appendText('If you enable current setting, it will override incompatible Obsidian settings and will work as expected.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldIgnoreIncompatibleObsidianSettings');
      });

    new SettingEx(this.containerEl)
      .setName('Should allow empty embed alias')
      .setDesc('Whether to allow empty embed alias. If disabled, empty alias will be replaced with the attachment name.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldAllowEmptyEmbedAlias');
      });

    new SettingEx(this.containerEl)
      .setName('Should include attachment extension to embed alias')
      .setDesc('Whether to include the extension of the attachment in the embed alias.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldIncludeAttachmentExtensionToEmbedAlias');
      });

    new SettingEx(this.containerEl)
      .setName('Should preserve existing link style')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to preserve the existing link style when converting links.');
        f.createEl('br');
        f.appendText('If enabled, the existing link style will be preserved when converting links.');
        f.createEl('br');
        f.appendText('If disabled, the existing links style will be changed to the default link style defined in Obsidian settings.');
        f.createEl('br');
        f.appendText('If disabled and ');
        appendCodeBlock(f, 'Should ignore incompatible Obsidian settings');
        f.appendText(' setting is set, the existing link style will be changed to the markdown link style.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldPreserveExistingLinkStyle');
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
        this.bind(multipleText, 'includePaths');
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
        this.bind(multipleText, 'excludePaths');
      });
  }
}
