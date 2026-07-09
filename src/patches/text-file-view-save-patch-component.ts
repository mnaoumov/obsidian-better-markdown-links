import { TextFileView } from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { BetterMarkdownLinksComponent } from '../better-markdown-links-component.ts';

interface TextFileViewSavePatchComponentConstructorParams {
  readonly betterMarkdownLinksComponent: BetterMarkdownLinksComponent;
}

export class TextFileViewSavePatchComponent extends MonkeyAroundComponent {
  private readonly betterMarkdownLinksComponent: BetterMarkdownLinksComponent;

  public constructor(params: TextFileViewSavePatchComponentConstructorParams) {
    super();
    this.betterMarkdownLinksComponent = params.betterMarkdownLinksComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      methodName: 'save',
      obj: TextFileView.prototype,
      patchHandler: async ({ fallback, originalThis }) => {
        await fallback();
        const file = originalThis.file;
        if (file) {
          invokeAsyncSafely(() => this.betterMarkdownLinksComponent.handleSave(file));
        }
      }
    });
  }
}
