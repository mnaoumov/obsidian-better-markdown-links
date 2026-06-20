import {
  App,
  Workspace
} from 'obsidian';
import { handleSilentError } from 'obsidian-dev-utils/async';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { BetterMarkdownLinksComponent } from '../better-markdown-links-component.ts';

interface WorkspaceOpenLinkTextPatchComponentConstructorParams {
  readonly app: App;
  readonly betterMarkdownLinksComponent: BetterMarkdownLinksComponent;
}

export class WorkspaceOpenLinkTextPatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly betterMarkdownLinksComponent: BetterMarkdownLinksComponent;

  public constructor(params: WorkspaceOpenLinkTextPatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.betterMarkdownLinksComponent = params.betterMarkdownLinksComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
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
          await this.betterMarkdownLinksComponent.handleModify(sourceFile);
        } catch (error) {
          if (handleSilentError(error)) {
            return;
          }
          throw error;
        }
      }
    });
  }
}
