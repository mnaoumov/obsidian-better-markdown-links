import { appendCodeBlock } from 'obsidian-dev-utils/HTMLElement';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { SettingEx } from 'obsidian-dev-utils/obsidian/SettingEx';

import type { PluginTypes } from './PluginTypes.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
  public override display(): void {
    super.display();
    this.containerEl.empty();

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
        this.bind(toggle, 'shouldUseLeadingDotForRelativePaths');
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
        this.bind(toggle, 'shouldAllowEmptyEmbedAlias');
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
        appendCodeBlock(f, '![image](path/to/image)');
      }))
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
