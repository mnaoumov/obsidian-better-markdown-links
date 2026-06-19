import type { App } from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { ConsoleDebugComponent } from 'obsidian-dev-utils/obsidian/components/console-debug-component';
import type { GenerateMarkdownLinkParams } from 'obsidian-dev-utils/obsidian/link';

import {
  TAbstractFile,
  TFile,
  Workspace
} from 'obsidian';
import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
import {
  convertAsyncToSync,
  handleSilentError
} from 'obsidian-dev-utils/async';
import { SilentError } from 'obsidian-dev-utils/error';
import { GenerateMarkdownLinkDefaultParamsComponent } from 'obsidian-dev-utils/obsidian/components/generate-markdown-link-default-params-component';
import { LayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';
import { convertLink } from 'obsidian-dev-utils/obsidian/link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/metadata-cache';

import type { LinkConverter } from './link-converter.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { GenerateMarkdownLinkPatchComponent } from './generate-markdown-link-extended-impl.ts';

interface BetterMarkdownLinksComponentConstructorParams {
  readonly abortSignalComponent: AbortSignalComponent;
  readonly app: App;
  readonly consoleDebugComponent: ConsoleDebugComponent;
  readonly linkConverter: LinkConverter;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class BetterMarkdownLinksComponent extends LayoutReadyComponent {
  private readonly abortSignalComponent: AbortSignalComponent;
  private readonly consoleDebugComponent: ConsoleDebugComponent;
  private readonly linkConverter: LinkConverter;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly processFileAbortControllers = new Map<string, AbortController>();

  public constructor(params: BetterMarkdownLinksComponentConstructorParams) {
    super(params.app);

    this.abortSignalComponent = params.abortSignalComponent;
    this.consoleDebugComponent = params.consoleDebugComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.linkConverter = params.linkConverter;
  }

  protected override onLayoutReady(): void {
    this.addChild(new GenerateMarkdownLinkPatchComponent(this.app));
    this.addChild(
      new GenerateMarkdownLinkDefaultParamsComponent({
        app: this.app,
        getDefaultParams: (): Partial<GenerateMarkdownLinkParams> => {
          return this.pluginSettingsComponent.settings;
        }
      })
    );

    this.registerEvent(this.app.vault.on('modify', convertAsyncToSync(this.handleModify.bind(this))));

    const patch = this.addChild(new MonkeyAroundComponent());
    patch.registerMethodPatch({
      methodName: 'openLinkText',
      obj: Workspace.prototype,
      patchHandler: async ({
        fallback,
        originalArgs: [, sourcePath]
      }) => {
        await fallback();
        const sourceFile = this.app.vault.getFileByPath(sourcePath);
        if (!sourceFile) {
          return;
        }

        try {
          await this.handleModify(sourceFile);
        } catch (error) {
          if (handleSilentError(error)) {
            return;
          }
          throw error;
        }
      }
    });
  }

  private async handleModify(file: TAbstractFile): Promise<void> {
    this.abortSignalComponent.abortSignal.throwIfAborted();

    if (!(file instanceof TFile)) {
      return;
    }

    let processFileAbortController = this.processFileAbortControllers.get(file.path);
    processFileAbortController?.abort(new SilentError(`File ${file.path} is already being processed`));
    this.processFileAbortControllers.delete(file.path);

    if (!this.pluginSettingsComponent.settings.shouldAutomaticallyConvertNewLinks) {
      return;
    }

    const suggestionContainer = activeDocument.querySelector<HTMLDivElement>('.suggestion-container');
    if (suggestionContainer?.isShown()) {
      return;
    }

    if (this.pluginSettingsComponent.settings.isPathIgnored(file.path)) {
      this.consoleDebugComponent.consoleDebug(`File ${file.path} is ignored in plugin settings, skipping`);
      return;
    }

    processFileAbortController = new AbortController();
    this.processFileAbortControllers.set(file.path, processFileAbortController);
    try {
      const combinedAbortSignal = abortSignalAny(this.abortSignalComponent.abortSignal, processFileAbortController.signal);
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
            linkStyle: this.pluginSettingsComponent.settings.getLinkStyle(true),
            newSourcePathOrFile: file
          })
        )
      ) {
        await this.linkConverter.convertLinksInFile({
          abortSignal: combinedAbortSignal,
          file
        });
      }
    } finally {
      this.processFileAbortControllers.delete(file.path);
    }
  }
}
