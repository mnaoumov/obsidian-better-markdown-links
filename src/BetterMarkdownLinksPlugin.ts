import { around } from 'monkey-around';
import {
  Notice,
  PluginSettingTab,
  TFile
} from 'obsidian';
import type { MaybePromise } from 'obsidian-dev-utils/Async';
import { chainAsyncFn } from 'obsidian-dev-utils/obsidian/ChainedPromise';
import type { GenerateMarkdownLinkDefaultOptionsWrapper } from 'obsidian-dev-utils/obsidian/Link';
import { convertLink } from 'obsidian-dev-utils/obsidian/Link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/MetadataCache';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import type { RenameDeleteHandlerSettings } from 'obsidian-dev-utils/obsidian/RenameDeleteHandler';
import { registerRenameDeleteHandlers } from 'obsidian-dev-utils/obsidian/RenameDeleteHandler';
import { MARKDOWN_FILE_EXTENSION } from 'obsidian-dev-utils/obsidian/TAbstractFile';

import BetterMarkdownLinksPluginSettings from './BetterMarkdownLinksPluginSettings.ts';
import BetterMarkdownLinksPluginSettingsTab from './BetterMarkdownLinksPluginSettingsTab.ts';
import type { GenerateMarkdownLinkFn } from './GenerateMarkdownLink.ts';
import { getPatchedGenerateMarkdownLink } from './GenerateMarkdownLink.ts';
import {
  applyLinkChangeUpdates,
  convertLinksInCurrentFile,
  convertLinksInEntireVault,
  convertLinksInFile
} from './LinkConverter.ts';

export default class BetterMarkdownLinksPlugin extends PluginBase<BetterMarkdownLinksPluginSettings> {
  private warningNotice!: Notice;
  private processingMetadataFiles = new Set<string>();

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
      chainAsyncFn(this.app, () => this.handleMetadataCacheChanged(file));
    }));

    registerRenameDeleteHandlers(this, () => {
      const settings: Partial<RenameDeleteHandlerSettings> = {
        shouldUpdateFilenameAliases: true,
        shouldUpdateLinks: this.settings.automaticallyUpdateLinksOnRenameOrMove
      };
      return settings;
    });

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

    if (this.processingMetadataFiles.has(file.path)) {
      return;
    }

    this.processingMetadataFiles.add(file.path);

    try {
      const cache = await getCacheSafe(this.app, file);
      if (!cache) {
        return;
      }
      const links = getAllLinks(cache);
      if (links.some((link) => link.original !== convertLink({
        app: this.app,
        link,
        sourcePathOrFile: file
      }))) {
        await convertLinksInFile(this, file);
      }
    } finally {
      this.processingMetadataFiles.delete(file.path);
    }
  }
}
