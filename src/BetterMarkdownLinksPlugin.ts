import {
  type LinkCache,
  Notice,
  Plugin,
  type TFile,
} from "obsidian";
import BetterMarkdownLinksPluginSettings from "./BetterMarkdownLinksPluginSettings.ts";
import BetterMarkdownLinksPluginSettingsTab from "./BetterMarkdownLinksPluginSettingsTab.ts";
import { around } from "monkey-around";
import {
  getAllLinks,
  getCacheSafe
} from "./MetadataCache.ts";
import { convertToSync } from "./Async.ts";
import {
  dirname,
  relative
} from "node:path/posix";
import type { LinkChangeUpdate } from "obsidian-typings";

type GenerateMarkdownLinkFn = (file: TFile, sourcePath: string, subpath?: string, alias?: string) => string;

type FileChange = {
  startIndex: number;
  endIndex: number;
  newContent: string;
};

const SPECIAL_LINK_SYMBOLS_REGEXP = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

export default class BetterMarkdownLinksPlugin extends Plugin {
  private _settings!: BetterMarkdownLinksPluginSettings;
  private warningNotice!: Notice;

  public get settings(): BetterMarkdownLinksPluginSettings {
    return BetterMarkdownLinksPluginSettings.clone(this._settings);
  }

  public override async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new BetterMarkdownLinksPluginSettingsTab(this));
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));

    this.register(around(this.app.fileManager, {
      "generateMarkdownLink": (): GenerateMarkdownLinkFn => this.generateMarkdownLink.bind(this)
    }));

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

    this.registerEvent(this.app.metadataCache.on("changed", (file) => convertToSync(this.handleMetadataCacheChanged(file))));

    this.warningNotice = new Notice("");
    this.warningNotice.hide();

    this.app.fileManager.linkUpdaters["md"] = {
      applyUpdates: this.applyUpdates.bind(this),
      iterateReferences: (): void => { },
      renameSubpath: async (): Promise<void> => { }
    };

    this.register(() => {
      delete this.app.fileManager.linkUpdaters["md"];
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

    const message = "Your Obsidian settings are incompatible with the \"Better Markdown Links\" plugin. Please disable \"Use [[Wikilinks]]\" and set \"New link format\" to \"Relative path to file\" in Obsidian settings.\nAlternatively, you can enable the \"Ignore incompatible Obsidian settings\" option in the plugin settings.";
    console.warn(message);

    if (this.warningNotice.noticeEl.style.opacity === "0") {
      this.warningNotice = new Notice(message, 10000);
    }
    return false;
  }

  private generateMarkdownLink(file: TFile, sourcePath: string, subpath?: string, alias?: string, isEmbed?: boolean, isWikilink?: boolean): string {
    subpath ??= "";
    alias ??= "";
    const isMarkdownFile = file.extension.toLowerCase() === "md";
    isEmbed ??= !isMarkdownFile;
    isWikilink ??= !this._settings.ignoreIncompatibleObsidianSettings && !this.app.vault.getConfig("useMarkdownLinks");
    const useRelativePath = this._settings.ignoreIncompatibleObsidianSettings || this.app.vault.getConfig("newLinkFormat") === "relative";

    let linkText = file.path === sourcePath && subpath
      ? subpath
      : useRelativePath
        ? relative(dirname(sourcePath), isWikilink && isMarkdownFile ? file.path.slice(0, -".md".length) : file.path) + subpath
        : this.app.metadataCache.fileToLinktext(file, sourcePath, isWikilink) + subpath;

    if (useRelativePath && this._settings.useLeadingDot && !linkText.startsWith(".") && !linkText.startsWith("#")) {
      linkText = "./" + linkText;
    }

    if (!isWikilink) {
      if (this._settings.useAngleBrackets) {
        linkText = `<${linkText}>`;
      } else {
        linkText = linkText.replace(SPECIAL_LINK_SYMBOLS_REGEXP, function (specialLinkSymbol) {
          return encodeURIComponent(specialLinkSymbol);
        });
      }

      if (!isEmbed) {
        return `[${alias || file.basename}](${linkText})`;
      } else {
        return `![${alias}](${linkText})`;
      }
    } else {
      if (alias && alias.toLowerCase() === linkText.toLowerCase()) {
        linkText = alias;
        alias = "";
      }

      return (isEmbed ? "!" : "") + (alias ? `[[${linkText}|${alias}]]` : `[[${linkText}]]`);
    }
  }

  private convertLinksInCurrentFile(checking: boolean): boolean {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension.toLowerCase() !== "md") {
      return false;
    }

    if (!checking) {
      convertToSync(this.convertLinksInFile(activeFile));
    }

    return true;
  }

  private async convertLinksInFile(file: TFile): Promise<void> {
    if (!this.checkObsidianSettingsCompatibility()) {
      return;
    }

    const cache = await getCacheSafe(this.app, file);

    await this.editFile(file, getAllLinks(cache).map(link => ({
      startIndex: link.position.start.offset,
      endIndex: link.position.end.offset,
      newContent: this.convertLink(link, file)
    })));
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

    let linkFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, source.path);
    if (!linkFile) {
      if (linkPath.startsWith("../")) {
        linkFile = this.app.metadataCache.getFirstLinkpathDest(linkPath.slice("../".length), source.path);
      }

      if (!linkFile) {
        return link.original;
      }
    }

    const subpath = originalSubpath ? "#" + originalSubpath : undefined;

    const isLinkEmbed = link.original.startsWith("!");
    return this.generateMarkdownLink(linkFile, source.path, subpath, link.displayText, isLinkEmbed);
  }

  private async handleMetadataCacheChanged(file: TFile): Promise<void> {
    if (!this._settings.automaticallyConvertNewLinks) {
      return;
    }

    const suggestionContainer = document.querySelector<HTMLDivElement>(".suggestion-container");
    if (suggestionContainer && suggestionContainer.style.display !== "none") {
      return;
    }

    const cache = await getCacheSafe(this.app, file);
    const links = getAllLinks(cache);
    if (links.some(link => link.original !== this.convertLink(link, file))) {
      await this.convertLinksInFile(file);
    }
  }

  private async applyUpdates(file: TFile, updates: LinkChangeUpdate[]): Promise<void> {
    await this.editFile(file, updates.map(update => ({
      startIndex: update.reference.position.start.offset,
      endIndex: update.reference.position.end.offset,
      newContent: this.fixChange(update.change, file)
    })));
  }

  /**
   * BUG: https://forum.obsidian.md/t/update-internal-link-breaks-links-with-angle-brackets/85598
   */
  private fixChange(change: string, file: TFile): string {
    const match = change.match(/^!?\[(.*?)\]\(([^<]+?) .+?>\)$/);
    const isEmbed = change.startsWith("!");

    if (!match) {
      return change;
    }

    const alias = match[1]!;
    const escapedPath = match[2]!;
    const [linkPath = "", originalSubpath] = decodeURIComponent(escapedPath).split("#");
    const linkedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
    if (!linkedFile) {
      return `${isEmbed ? "!" : ""}[${alias}](${escapedPath})`;
    }

    const subpath = originalSubpath ? "#" + originalSubpath : undefined;
    return this.generateMarkdownLink(linkedFile, file.path, subpath, alias, isEmbed, false);
  }

  private async editFile(file: TFile, changes: FileChange[]): Promise<void> {
    changes.sort((a, b) => b.startIndex - a.startIndex);

    for (let i = 1; i < changes.length; i++) {
      if (changes[i - 1]!.endIndex >= changes[i]!.startIndex) {
        throw new Error(`Overlapping changes:\n${JSON.stringify(changes[i - 1], null, 2)}\n${JSON.stringify(changes[i], null, 2)}`);
      }
    }

    await this.app.vault.process(file, (content) => {
      let newContent = "";
      let lastIndex = 0;

      for (const change of changes) {
        newContent += content.slice(lastIndex, change.startIndex);
        newContent += change.newContent;
        lastIndex = change.endIndex;
      }

      newContent += content.slice(lastIndex);
      return newContent;
    });
  }
}
