import { around } from 'monkey-around';
import type { TAbstractFile } from 'obsidian';
import {
  Notice,
  PluginSettingTab,
  TFile
} from 'obsidian';
import type { MaybePromise } from 'obsidian-dev-utils/Async';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';
import type { GenerateMarkdownLinkDefaultOptionsWrapper } from 'obsidian-dev-utils/obsidian/Link';
import {
  getAllLinks,
  getBacklinksForFileSafe,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/MetadataCache';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import {
  isMarkdownFile,
  MARKDOWN_FILE_EXTENSION
} from 'obsidian-dev-utils/obsidian/TAbstractFile';
import { applyFileChanges } from 'obsidian-dev-utils/obsidian/Vault';
import { dirname } from 'obsidian-dev-utils/Path';
import { registerRenameDeleteHandlers } from 'obsidian-dev-utils/obsidian/RenameDeleteHandler';

import BetterMarkdownLinksPluginSettings from './BetterMarkdownLinksPluginSettings.ts';
import BetterMarkdownLinksPluginSettingsTab from './BetterMarkdownLinksPluginSettingsTab.ts';
import type { GenerateMarkdownLinkFn } from './GenerateMarkdownLink.ts';
import { getPatchedGenerateMarkdownLink } from './GenerateMarkdownLink.ts';
import {
  applyLinkChangeUpdates,
  convertLink,
  convertLinksInCurrentFile,
  convertLinksInEntireVault,
  convertLinksInFile,
  updateLink,
  updateLinksInFile
} from './LinkConverter.ts';

export default class BetterMarkdownLinksPlugin extends PluginBase<BetterMarkdownLinksPluginSettings> {
  private warningNotice!: Notice;

  protected override createDefaultPluginSettings(): BetterMarkdownLinksPluginSettings {
    return new BetterMarkdownLinksPluginSettings();
  }

  protected override createPluginSettingsTab(): PluginSettingTab | null {
    return new BetterMarkdownLinksPluginSettingsTab(this);
  }

  protected override onloadComplete(): MaybePromise<void> {
    this.register(around(this.app.fileManager, {
      generateMarkdownLink: (): GenerateMarkdownLinkFn & GenerateMarkdownLinkDefaultOptionsWrapper => getPatchedGenerateMarkdownLink(this)
    }));

    this.addCommand({
      id: 'convert-links-in-current-file',
      name: 'Convert links in current file',
      checkCallback: (checking) => convertLinksInCurrentFile(this, checking)
    });

    this.addCommand({
      id: 'convert-links-in-entire-vault',
      name: 'Convert links in entire vault',
      callback: () => convertLinksInEntireVault(this)
    });

    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      invokeAsyncSafely(this.handleMetadataCacheChanged(file));
    }));

    registerRenameDeleteHandlers(this, () => ({
      shouldUpdateLinks: this.settings.automaticallyUpdateLinksOnRenameOrMove
    }));

    this.warningNotice = new Notice('');
    this.warningNotice.hide();

    this.app.fileManager.linkUpdaters[MARKDOWN_FILE_EXTENSION] = {
      applyUpdates: (file, updates): Promise<void> => applyLinkChangeUpdates(this, file, updates),
      iterateReferences: (): void => {
        // Do nothing
      },
      renameSubpath: async (): Promise<void> => {
        // Do nothing
      }
    };

    this.register(() => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.app.fileManager.linkUpdaters[MARKDOWN_FILE_EXTENSION];
    });
  }

  public showCompatibilityWarning(): void {
    const message = 'Your Obsidian settings are incompatible with the "Better Markdown Links" plugin. Please disable "Use [[Wikilinks]]" and set "New link format" to "Relative path to file" in Obsidian settings.\nAlternatively, you can enable the "Ignore incompatible Obsidian settings" option in the plugin settings.';
    console.warn(message);

    if (this.warningNotice.noticeEl.style.opacity === '0') {
      this.warningNotice = new Notice(message, 10000);
    }
  }

  private async handleMetadataCacheChanged(file: TFile): Promise<void> {
    if (!this.settings.automaticallyConvertNewLinks) {
      return;
    }

    const suggestionContainer = document.querySelector<HTMLDivElement>('.suggestion-container');
    if (suggestionContainer && suggestionContainer.style.display !== 'none') {
      return;
    }

    const cache = await getCacheSafe(this.app, file);
    if (!cache) {
      return;
    }
    const links = getAllLinks(cache);
    if (links.some((link) => link.original !== convertLink(this, link, file))) {
      await convertLinksInFile(this, file);
    }
  }
}
