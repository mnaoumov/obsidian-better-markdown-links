import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { handleSilentError } from '@mnaoumov/typescript-lib/async';
import {
  App,
  Workspace
} from 'obsidian';

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
      $object: Workspace.prototype,
      methodName: 'openLinkText',
      patchHandler: async ({
        fallback,
        originalArguments: [, sourcePath]
      }) => {
        await fallback();
        const sourceFile = this.app.vault.getFileByPath(sourcePath);
        if (!sourceFile) {
          return;
        }

        try {
          await this.betterMarkdownLinksComponent.handleNavigation(sourceFile);
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
