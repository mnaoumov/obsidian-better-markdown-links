import {
  PluginSettingTab,
  Setting
} from "obsidian";
import type BetterMarkdownLinksPlugin from "./BetterMarkdownLinksPlugin.ts";

export default class BetterMarkdownLinksPluginSettingsTab extends PluginSettingTab {
  public override plugin: BetterMarkdownLinksPlugin;

  public constructor(plugin: BetterMarkdownLinksPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  public override display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "Better Markdown Links" });

    const settings = this.plugin.settings;

    new Setting(this.containerEl)
      .setName("Use leading dot")
      .setDesc("Use a leading dot in relative links")
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useLeadingDot)
          .onChange(async (value) => {
            settings.useLeadingDot = value;
            await this.plugin.saveSettings(settings);
          })
      );

    new Setting(this.containerEl)
      .setName("Use angle brackets")
      .setDesc("Use angle brackets in links")
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useAngleBrackets)
          .onChange(async (value) => {
            settings.useAngleBrackets = value;
            await this.plugin.saveSettings(settings);
          })
      );

    new Setting(this.containerEl)
      .setName("Ignore incompatible Obsidian settings")
      .setDesc(createDocumentFragment(`Current plugin makes sense only if you have <code>Use [[Wikilinks]]</code> disabled and <code>New link format</code> set to <code>Relative path to file</code> in Obsidian settings.<br>
If you enable current setting, it will override incompatible Obsidian settings and will work as expected.`))
      .addToggle((toggle) =>
        toggle
          .setValue(settings.ignoreIncompatibleObsidianSettings)
          .onChange(async (value) => {
            settings.ignoreIncompatibleObsidianSettings = value;
            await this.plugin.saveSettings(settings);
          })
      );
  }
}

function createDocumentFragment(html: string): DocumentFragment {
  const template = createEl("template");
  template.innerHTML = html;
  return template.content;
}