import { Setting } from 'obsidian';
import { appendCodeBlock } from 'obsidian-dev-utils/DocumentFragment';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';
import { bindUiComponent } from 'obsidian-dev-utils/obsidian/Plugin/UIComponent';

import type BetterMarkdownLinksPlugin from './BetterMarkdownLinksPlugin.ts';

export default class BetterMarkdownLinksPluginSettingsTab extends PluginSettingsTabBase<BetterMarkdownLinksPlugin> {
  public override display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName('Use leading dot')
      .setDesc('Use a leading dot in relative links')
      .addToggle((toggle) => bindUiComponent(this.plugin, toggle, 'useLeadingDot'));

    new Setting(this.containerEl)
      .setName('Use angle brackets')
      .setDesc('Use angle brackets in links')
      .addToggle((toggle) => bindUiComponent(this.plugin, toggle, 'useAngleBrackets'));

    new Setting(this.containerEl)
      .setName('Automatically convert new links')
      .setDesc('Automatically convert new links entered manually to the selected format')
      .addToggle((toggle) => bindUiComponent(this.plugin, toggle, 'automaticallyConvertNewLinks'));

    new Setting(this.containerEl)
      .setName('Automatically update links on rename or move')
      .setDesc(createFragment((f) => {
        f.appendText('Automatically update links when a file is renamed or moved to another directory.');
        f.createEl('br');
        f.appendText('Consider installing');
        f.createEl('a', {
          href: 'obsidian://show-plugin?id=backlink-cache',
          text: 'Backlink Cache'
        });
        f.appendText(' plugin to improve performance.');
      }))
      .addToggle((toggle) => bindUiComponent(this.plugin, toggle, 'automaticallyUpdateLinksOnRenameOrMove'));

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
      .addToggle((toggle) => bindUiComponent(this.plugin, toggle, 'ignoreIncompatibleObsidianSettings'));
  }
}
