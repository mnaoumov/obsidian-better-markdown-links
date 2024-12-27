import { Setting } from 'obsidian';
import { appendCodeBlock } from 'obsidian-dev-utils/DocumentFragment';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { extend } from 'obsidian-dev-utils/obsidian/Plugin/ValueComponent';
import { isValidRegExp } from 'obsidian-dev-utils/RegExp';

import type { BetterMarkdownLinksPlugin } from './BetterMarkdownLinksPlugin.ts';

export class BetterMarkdownLinksPluginSettingsTab extends PluginSettingsTabBase<BetterMarkdownLinksPlugin> {
  public override display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName('Use leading dot')
      .setDesc('Use a leading dot in relative links')
      .addToggle((toggle) => extend(toggle).bind(this.plugin, 'useLeadingDot'));

    new Setting(this.containerEl)
      .setName('Use angle brackets')
      .setDesc('Use angle brackets in links')
      .addToggle((toggle) => extend(toggle).bind(this.plugin, 'useAngleBrackets'));

    new Setting(this.containerEl)
      .setName('Automatically convert new links')
      .setDesc('Automatically convert new links entered manually to the selected format')
      .addToggle((toggle) => extend(toggle).bind(this.plugin, 'automaticallyConvertNewLinks'));

    new Setting(this.containerEl)
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
      .addToggle((toggle) => extend(toggle).bind(this.plugin, 'automaticallyUpdateLinksOnRenameOrMove'));

    new Setting(this.containerEl)
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
      .addToggle((toggle) => extend(toggle).bind(this.plugin, 'ignoreIncompatibleObsidianSettings'));

    new Setting(this.containerEl)
      .setName('Allow empty embed alias')
      .setDesc('If disabled, empty alias will be replaced with the attachment name')
      .addToggle((toggle) => extend(toggle).bind(this.plugin, 'allowEmptyEmbedAlias'));

    new Setting(this.containerEl)
      .setName('Include attachment extension to embed alias')
      .setDesc(createFragment((f) => {
        f.appendText('If enabled, the extension of the attachment will be included in the embed alias.');
        f.createEl('br');
        f.appendText('The setting is ignored if ');
        appendCodeBlock(f, 'Allow empty embed alias');
        f.appendText(' is enabled.');
      }))
      .addToggle((toggle) => extend(toggle).bind(this.plugin, 'includeAttachmentExtensionToEmbedAlias'));

    const pathBindSettings = {
      componentToPluginSettingsValueConverter: (value: string): string[] => value.split('\n').filter(Boolean),
      pluginSettingsToComponentValueConverter: (value: string[]): string => value.join('\n'),
      valueValidator: (value: string): null | string => {
        const paths = value.split('\n');
        for (const path of paths) {
          if (path.startsWith('/') && path.endsWith('/')) {
            const regExp = path.slice(1, -1);
            if (!isValidRegExp(regExp)) {
              return `Invalid regular expression ${path}`;
            }
          }
        }
        return null;
      }
    };

    new Setting(this.containerEl)
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
      .addTextArea((textArea) => extend(textArea).bind(this.plugin, 'includePaths', pathBindSettings));

    new Setting(this.containerEl)
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
      .addTextArea((textArea) => extend(textArea).bind(this.plugin, 'excludePaths', pathBindSettings));
  }
}
