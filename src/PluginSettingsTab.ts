import { appendCodeBlock } from 'obsidian-dev-utils/HTMLElement';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { SettingEx } from 'obsidian-dev-utils/obsidian/SettingEx';

import type { PluginTypes } from './PluginTypes.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

    new SettingEx(this.containerEl)
      .setName('Use leading dot')
      .setDesc('Use a leading dot in relative links')
      .addToggle((toggle) => {
        this.bind(toggle, 'useLeadingDot');
      });

    new SettingEx(this.containerEl)
      .setName('Use angle brackets')
      .setDesc('Use angle brackets in links')
      .addToggle((toggle) => {
        this.bind(toggle, 'useAngleBrackets');
      });

    new SettingEx(this.containerEl)
      .setName('Automatically convert new links')
      .setDesc('Automatically convert new links entered manually to the selected format')
      .addToggle((toggle) => {
        this.bind(toggle, 'automaticallyConvertNewLinks');
      });

    new SettingEx(this.containerEl)
      .setName('Automatically update links on rename or move')
      .setDesc(createFragment((f) => {
        f.appendText('Automatically update links when a file is renamed or moved to another directory.');
        f.createEl('br');
        f.appendText('Consider installing the ');
        f.createEl('a', {
          href: 'obsidian://show-plugin?id=backlink-cache',
          text: 'Backlink Cache'
        });
        f.appendText(' plugin to improve performance.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'automaticallyUpdateLinksOnRenameOrMove');
      });

    new SettingEx(this.containerEl)
      .setName('Ignore incompatible Obsidian settings')
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
        this.bind(toggle, 'ignoreIncompatibleObsidianSettings');
      });

    new SettingEx(this.containerEl)
      .setName('Allow empty embed alias')
      .setDesc('If disabled, empty alias will be replaced with the attachment name')
      .addToggle((toggle) => {
        this.bind(toggle, 'allowEmptyEmbedAlias');
      });

    new SettingEx(this.containerEl)
      .setName('Include attachment extension to embed alias')
      .setDesc(createFragment((f) => {
        f.appendText('If enabled, the extension of the attachment will be included in the embed alias.');
        f.createEl('br');
        f.appendText('The setting is ignored if ');
        appendCodeBlock(f, 'Allow empty embed alias');
        f.appendText(' is enabled.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'includeAttachmentExtensionToEmbedAlias');
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
