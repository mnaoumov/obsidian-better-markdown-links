import {
  Plugin,
  type TFile
} from "obsidian";
import BetterMarkdownLinksPluginSettings from "./BetterMarkdownLinksPluginSettings.ts";
import BetterMarkdownLinksPluginSettingsTab from "./BetterMarkdownLinksPluginSettingsTab.ts";
import { around } from "monkey-around";

type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

export default class BetterMarkdownLinksPlugin extends Plugin {
  private _settings!: BetterMarkdownLinksPluginSettings;

  public get settings(): BetterMarkdownLinksPluginSettings {
    return BetterMarkdownLinksPluginSettings.clone(this._settings);
  }

  public override async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new BetterMarkdownLinksPluginSettingsTab(this));
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));

    const uninstaller = around(this.app.fileManager, {
      "generateMarkdownLink": (originalFn: GenerateMarkdownLinkFn): GenerateMarkdownLinkFn =>
        (file: TFile, sourcePath: string, subpath?: string, alias?: string) => this.generateMarkdownLink(file, sourcePath, subpath, alias, originalFn)
    });

    this.register(() => {
      uninstaller();
    });
  }

  public async saveSettings(newSettings: BetterMarkdownLinksPluginSettings): Promise<void> {
    this._settings = BetterMarkdownLinksPluginSettings.clone(newSettings);
    await this.saveData(this._settings);
  }

  private async onLayoutReady(): Promise<void> {
  }

  private async loadSettings(): Promise<void> {
    this._settings = BetterMarkdownLinksPluginSettings.load(await this.loadData());
  }

  private generateMarkdownLink(file: TFile, sourcePath: string, subpath: string | undefined, alias: string | undefined, originalFn: GenerateMarkdownLinkFn): string {
    const useWikilinks = !this.app.vault.getConfig("useMarkdownLinks");
    const newLinkFormat = this.app.vault.getConfig("newLinkFormat");

    if (!this._settings.ignoreIncompatibleObsidianSettings && (useWikilinks || newLinkFormat !== "relative")) {
      console.warn("Your Obsidian settings are incompatible with the current plugin. Please disable \"Use [[Wikilinks]]\" and set \"New link format\" to \"Relative path to file\" in Obsidian settings.");
      return originalFn(file, sourcePath, subpath, alias);
    }

    let linkText = file.path === sourcePath && subpath ? subpath : this.app.metadataCache.fileToLinktext(file, sourcePath, true) + (subpath || "");
    if (this._settings.useLeadingDot && !linkText.startsWith(".") && !linkText.startsWith("#")) {
      linkText = "./" + linkText;
    }

    if (this._settings.useAngleBrackets) {
      linkText = `<${linkText}>`;
    } else {
      linkText = encodeURIComponent(linkText);
    }

    if (file.extension.toLowerCase() === "md") {
      return `[${alias || file.basename}](${linkText})`;
    } else {
      return `![](${linkText})`;
    }
  }
}
