import type {
  App,
  FileManager
} from 'obsidian';

import { TFile } from 'obsidian';
import {
  normalizeOptionalProperties,
  removeUndefinedProperties
} from 'obsidian-dev-utils/object-utils';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';
import { generateMarkdownLink } from 'obsidian-dev-utils/obsidian/link';

import type {
  GenerateMarkdownLinkExtendedOptions,
  GenerateMarkdownLinkExtendedWrapper
} from './generate-markdown-link-extended.d.ts';

export type GenerateMarkdownLinkNativeFn = FileManager['generateMarkdownLink'];

export class GenerateMarkdownLinkPatchComponent extends MonkeyAroundComponent {
  public constructor(private readonly app: App) {
    super();
  }

  public override onload(): void {
    const app = this.app;

    this.registerPatch(this.app.fileManager, {
      generateMarkdownLink(): GenerateMarkdownLinkExtendedWrapper & GenerateMarkdownLinkNativeFn {
        return Object.assign(native, { extended });

        function native(file: TFile, sourcePath: string, subpath?: string, alias?: string): string {
          return generateMarkdownLinkNative(app, file, sourcePath, subpath, alias);
        }

        function extended(options: GenerateMarkdownLinkExtendedOptions): string {
          return generateMarkdownLinkExtended(app, options);
        }
      }
    });
  }
}

function generateMarkdownLinkExtended(app: App, options: GenerateMarkdownLinkExtendedOptions): string {
  return generateMarkdownLink({
    app,
    ...options
  });
}

function generateMarkdownLinkNative(app: App, file: TFile, sourcePath: string, subpath?: string, alias?: string): string {
  return generateMarkdownLinkExtended(
    app,
    removeUndefinedProperties(normalizeOptionalProperties<GenerateMarkdownLinkExtendedOptions>({
      alias,
      sourcePathOrFile: sourcePath,
      subpath,
      targetPathOrFile: file
    }))
  );
}
