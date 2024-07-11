import {
  Notice,
  Plugin,
  type LinkCache,
  type TFile
} from "obsidian";
import BetterMarkdownLinksPluginSettings from "./BetterMarkdownLinksPluginSettings.ts";
import BetterMarkdownLinksPluginSettingsTab from "./BetterMarkdownLinksPluginSettingsTab.ts";
import { around } from "monkey-around";
import { getCacheSafe } from "./MetadataCache.ts";

type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

const SPECIAL_LINK_SYMBOLS_REGEXP = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

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

    this.addCommand({
      id: "convert-links-in-current-file",
      name: "Convert links in current file",
      checkCallback: this.convertLinksInCurrentFile.bind(this)
    });

    this.addCommand({
      id: "convert-links-in-entire-vault",
      name: "Convert links in entire vault",
      callback: this.convertLinksInEntireVault.bind(this)
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

  private checkObsidianSettingsCompatibility(): boolean {
    if (this._settings.ignoreIncompatibleObsidianSettings) {
      return true;
    }

    const useWikilinks = !this.app.vault.getConfig("useMarkdownLinks");
    const newLinkFormat = this.app.vault.getConfig("newLinkFormat");

    if (!useWikilinks && newLinkFormat === "relative") {
      return true;
    }

    const message = "Your Obsidian settings are incompatible with the \"Better Markdown Links\" plugin. Please disable \"Use [[Wikilinks]]\" and set \"New link format\" to \"Relative path to file\" in Obsidian settings.";
    console.warn(message);
    new Notice(message);
    return false;
  }

  private generateMarkdownLink(file: TFile, sourcePath: string, subpath: string | undefined, alias: string | undefined, originalFn: GenerateMarkdownLinkFn): string {
    if (!this.checkObsidianSettingsCompatibility()) {
      return originalFn(file, sourcePath, subpath, alias);
    }

    let linkText = file.path === sourcePath && subpath ? subpath : this.app.metadataCache.fileToLinktext(file, sourcePath, true) + (subpath || "");
    if (this._settings.useLeadingDot && !linkText.startsWith(".") && !linkText.startsWith("#")) {
      linkText = "./" + linkText;
    }

    if (this._settings.useAngleBrackets) {
      linkText = `<${linkText}>`;
    } else {
      linkText = linkText.replace(SPECIAL_LINK_SYMBOLS_REGEXP, function (specialLinkSymbol) {
        return encodeURIComponent(specialLinkSymbol);
      });
    }

    if (file.extension.toLowerCase() === "md") {
      return `[${alias || file.basename}](${linkText})`;
    } else {
      return `![](${linkText})`;
    }
  }

  private convertLinksInCurrentFile(checking: boolean): boolean {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension.toLowerCase() !== "md") {
      return false;
    }

    if (!checking) {
      this.convertLinksInFile(activeFile).catch(console.error);
    }

    return true;
  }

  private async convertLinksInFile(file: TFile): Promise<void> {
    if (!this.checkObsidianSettingsCompatibility()) {
      return;
    }

    const cache = await getCacheSafe(this.app, file);

    await this.app.vault.process(file, (content) => {
      let newContent = "";
      let lastIndex = 0;

      const links: LinkCache[] = [];

      if (cache.links) {
        links.push(...cache.links);
      }

      if (cache.embeds) {
        links.push(...cache.embeds);
      }

      links.sort((a, b) => a.position.start.offset - b.position.start.offset);

      for (const link of links) {
        newContent += content.slice(lastIndex, link.position.start.offset);
        newContent += this.convertLink(link, file);
        lastIndex = link.position.end.offset;
      }

      newContent += content.slice(lastIndex);
      return newContent;
    });
  }

  private async convertLinksInEntireVault(): Promise<void> {
    if (!this.checkObsidianSettingsCompatibility()) {
      return;
    }

    const mdFiles = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));

    let index = 0;

    const notice = new Notice("", 0);

    for (const file of mdFiles) {
      index++;
      const message = `Converting links in note # ${index} / ${mdFiles.length}: ${file.path}`;
      notice.setMessage(message);
      console.log(message);
      try {
        await this.convertLinksInFile(file);
      }
      catch (e) {
        console.error(e);
      }
    }

    notice.hide();
  }

  private convertLink(link: LinkCache, source: TFile): string {
    const [linkPath = "", originalSubpath] = link.link.split("#");

    const linkFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, source.path);
    if (!linkFile) {
      return link.original;
    }

    const subpath = originalSubpath ? "#" + originalSubpath : undefined;

    const newLink = this.app.fileManager.generateMarkdownLink(linkFile, source.path, subpath, link.displayText);
    const isLinkEmbed = link.original.startsWith("!");
    const isNewLinkEmbed = newLink.startsWith("!");

    if (isLinkEmbed === isNewLinkEmbed) {
      return newLink;
    }

    if (isLinkEmbed) {
      return "!" + newLink;
    }

    return newLink.replace("![]", `[${link.displayText}]`);
  }
}
