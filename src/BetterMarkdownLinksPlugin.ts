import {
  Notice,
  Plugin,
  type TAbstractFile,
  TFile
} from "obsidian";
import BetterMarkdownLinksPluginSettings from "./BetterMarkdownLinksPluginSettings.ts";
import BetterMarkdownLinksPluginSettingsTab from "./BetterMarkdownLinksPluginSettingsTab.ts";
import { around } from "monkey-around";
import {
  getAllLinks,
  getBacklinksForFileSafe,
  getCacheSafe
} from "./MetadataCache.ts";
import {
  convertToSync,
} from "./Async.ts";
import { dirname } from "node:path/posix";
import {
  generateMarkdownLink,
  type GenerateMarkdownLinkFn
} from "./GenerateMarkdownLink.ts";
import {
  isMarkdownFile,
  MARKDOWN_FILE_EXTENSION
} from "./TFile.ts";
import {
  applyLinkChangeUpdates,
  convertLink,
  convertLinksInCurrentFile,
  convertLinksInEntireVault,
  convertLinksInFile,
  updateLink,
  updateLinksInFile
} from "./LinkConverter.ts";
import { applyFileChanges } from "./Vault.ts";
import { showError } from "./Error.ts";

export default class BetterMarkdownLinksPlugin extends Plugin {
  private _settings!: BetterMarkdownLinksPluginSettings;
  private warningNotice!: Notice;

  public get settings(): BetterMarkdownLinksPluginSettings {
    return BetterMarkdownLinksPluginSettings.clone(this._settings);
  }

  public override async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new BetterMarkdownLinksPluginSettingsTab(this));

    this.register(around(this.app.fileManager, {
      "generateMarkdownLink": (): GenerateMarkdownLinkFn => (file: TFile, sourcePath: string, subpath?: string, alias?: string, isEmbed?: boolean, isWikilink?: boolean) =>
        generateMarkdownLink(this, file, sourcePath, subpath, alias, isEmbed, isWikilink)
    }));

    this.addCommand({
      id: "convert-links-in-current-file",
      name: "Convert links in current file",
      checkCallback: (checking) => convertLinksInCurrentFile(this, checking)
    });

    this.addCommand({
      id: "convert-links-in-entire-vault",
      name: "Convert links in entire vault",
      callback: () => convertLinksInEntireVault(this)
    });

    this.registerEvent(this.app.metadataCache.on("changed", (file) => convertToSync(this.handleMetadataCacheChanged(file))));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => convertToSync(this.handleRename(file, oldPath))));

    this.warningNotice = new Notice("");
    this.warningNotice.hide();

    this.app.fileManager.linkUpdaters[MARKDOWN_FILE_EXTENSION] = {
      applyUpdates: (file, updates): Promise<void> => applyLinkChangeUpdates(this, file, updates),
      iterateReferences: (): void => { },
      renameSubpath: async (): Promise<void> => { }
    };

    this.register(() => {
      delete this.app.fileManager.linkUpdaters[MARKDOWN_FILE_EXTENSION];
    });
  }

  public async saveSettings(newSettings: BetterMarkdownLinksPluginSettings): Promise<void> {
    this._settings = BetterMarkdownLinksPluginSettings.clone(newSettings);
    await this.saveData(this._settings);
  }

  private async loadSettings(): Promise<void> {
    this._settings = BetterMarkdownLinksPluginSettings.load(await this.loadData());
  }

  public showCompatibilityWarning(): void {
    const message = "Your Obsidian settings are incompatible with the \"Better Markdown Links\" plugin. Please disable \"Use [[Wikilinks]]\" and set \"New link format\" to \"Relative path to file\" in Obsidian settings.\nAlternatively, you can enable the \"Ignore incompatible Obsidian settings\" option in the plugin settings.";
    console.warn(message);

    if (this.warningNotice.noticeEl.style.opacity === "0") {
      this.warningNotice = new Notice(message, 10000);
    }
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
    if (links.some(link => link.original !== convertLink(this, link, file))) {
      await convertLinksInFile(this, file);
    }
  }

  private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
    if (!this._settings.automaticallyUpdateLinksOnRenameOrMove) {
      return;
    }

    if (!(file instanceof TFile)) {
      return;
    }

    if (isMarkdownFile(file) && file.parent?.path !== dirname(oldPath)) {
      await updateLinksInFile(this, file, oldPath);
    }

    await getCacheSafe(this.app, file);

    const backlinks = await getBacklinksForFileSafe(this.app, file);

    for (const parentNotePath of backlinks.keys()) {
      const parentNote = parentNotePath === oldPath ? file : this.app.vault.getFileByPath(parentNotePath);
      if (!parentNote) {
        showError(`Parent note not found: ${parentNotePath}`);
        continue;
      }
      await applyFileChanges(this.app, parentNote, async () => {
        const backlinks = await getBacklinksForFileSafe(this.app, file);
        return (backlinks.get(parentNotePath) ?? []).map(link => ({
          startIndex: link.position.start.offset,
          endIndex: link.position.end.offset,
          oldContent: link.original,
          newContent: updateLink(this, link, file, parentNote)
        }))
      });
    }
  }
}
