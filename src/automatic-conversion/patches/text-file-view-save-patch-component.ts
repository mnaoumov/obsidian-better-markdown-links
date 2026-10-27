import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { TextFileView } from 'obsidian';

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
      $object: TextFileView.prototype,
      methodName: 'save',
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
