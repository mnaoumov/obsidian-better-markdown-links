import type { GenerateMarkdownLinkDefaultOptionsWrapper } from 'obsidian-dev-utils/obsidian/Link';
import type { RenameDeleteHandlerSettings } from 'obsidian-dev-utils/obsidian/RenameDeleteHandler';

import {
  Notice,
  TFile
} from 'obsidian';
import { abortSignalAny } from 'obsidian-dev-utils/AbortController';
import { SilentError } from 'obsidian-dev-utils/Error';
import {
  noop,
  noopAsync
} from 'obsidian-dev-utils/Function';
import { MARKDOWN_FILE_EXTENSION } from 'obsidian-dev-utils/obsidian/FileSystem';
import { convertLink } from 'obsidian-dev-utils/obsidian/Link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/MetadataCache';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import { addToQueue } from 'obsidian-dev-utils/obsidian/Queue';
import { registerRenameDeleteHandlers } from 'obsidian-dev-utils/obsidian/RenameDeleteHandler';

import type { GenerateMarkdownLinkFn } from './GenerateMarkdownLink.ts';
import type { PluginTypes } from './PluginTypes.ts';

import { getPatchedGenerateMarkdownLink } from './GenerateMarkdownLink.ts';
import {
  applyLinkChangeUpdates,
  convertLinksInCurrentFile,
  convertLinksInEntireVault,
  convertLinksInFile
} from './LinkConverter.ts';
import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

export class Plugin extends PluginBase<PluginTypes> {
  public readonly processFileAbortControllers = new Map<string, AbortController>();

  private warningNotice!: Notice;

  public showCompatibilityWarning(): void {
    const message =
      'Your Obsidian settings are incompatible with the "Better Markdown Links" plugin. Please disable "Use [[Wikilinks]]" and set "New link format" to "Relative path to file" in Obsidian settings.\nAlternatively, you can enable the "Ignore incompatible Obsidian settings" option in the plugin settings.';
    console.warn(message);

    if (this.warningNotice.messageEl.style.opacity === '0') {
      const WARNING_NOTICE_DURATION_IN_MILLISECONDS = 10_000;
      this.warningNotice = new Notice(message, WARNING_NOTICE_DURATION_IN_MILLISECONDS);
    }
  }

  protected override createSettingsManager(): PluginSettingsManager {
    return new PluginSettingsManager(this);
  }

  protected override createSettingsTab(): null | PluginSettingsTab {
    return new PluginSettingsTab(this);
  }

  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();
    registerPatch(this, this.app.fileManager, {
      generateMarkdownLink: (): GenerateMarkdownLinkDefaultOptionsWrapper & GenerateMarkdownLinkFn => getPatchedGenerateMarkdownLink(this)
    });

    this.addCommand({
      checkCallback: (checking) => convertLinksInCurrentFile(this, checking),
      id: 'convert-links-in-current-file',
      name: 'Convert links in current file'
    });

    this.addCommand({
      callback: () => convertLinksInEntireVault(this, this.abortSignal),
      id: 'convert-links-in-entire-vault',
      name: 'Convert links in entire vault'
    });

    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      addToQueue(this.app, (abortSignal) => this.handleMetadataCacheChanged(file, abortSignal), this.abortSignal);
    }));

    registerRenameDeleteHandlers(this, () => {
      const settings: Partial<RenameDeleteHandlerSettings> = {
        isPathIgnored: (path) => {
          return this.settings.isPathIgnored(path);
        },
        shouldHandleRenames: this.settings.automaticallyUpdateLinksOnRenameOrMove,
        shouldUpdateFileNameAliases: true
      };
      return settings;
    });

    this.warningNotice = new Notice('');
    this.warningNotice.hide();

    this.app.fileManager.linkUpdaters[MARKDOWN_FILE_EXTENSION] = {
      applyUpdates: (file, updates): Promise<void> => applyLinkChangeUpdates(this, file, updates),
      iterateReferences: noop,
      renameSubpath: noopAsync
    };

    this.register(() => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.app.fileManager.linkUpdaters[MARKDOWN_FILE_EXTENSION];
    });
  }

  private async handleMetadataCacheChanged(file: TFile, abortSignal: AbortSignal): Promise<void> {
    abortSignal.throwIfAborted();

    let processFileAbortController = this.processFileAbortControllers.get(file.path);
    processFileAbortController?.abort(new SilentError(`File ${file.path} is already being processed`));
    this.processFileAbortControllers.delete(file.path);

    if (!this.settings.automaticallyConvertNewLinks) {
      return;
    }

    const suggestionContainer = document.querySelector<HTMLDivElement>('.suggestion-container');
    if (suggestionContainer && suggestionContainer.style.display !== 'none') {
      return;
    }

    processFileAbortController = new AbortController();
    this.processFileAbortControllers.set(file.path, processFileAbortController);
    try {
      const combinedAbortSignal = abortSignalAny(abortSignal, processFileAbortController.signal);
      const cache = await getCacheSafe(this.app, file);
      combinedAbortSignal.throwIfAborted();
      if (!cache) {
        return;
      }
      const links = getAllLinks(cache);
      if (
        links.some((link) =>
          link.original !== convertLink({
            app: this.app,
            link,
            newSourcePathOrFile: file
          })
        )
      ) {
        await convertLinksInFile(this, file, combinedAbortSignal);
      }
    } finally {
      this.processFileAbortControllers.delete(file.path);
    }
  }
}
