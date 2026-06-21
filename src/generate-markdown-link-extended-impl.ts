import type {
  App,
  FileManager
} from 'obsidian';

import {
  normalizeOptionalProperties,
  removeUndefinedProperties
} from 'obsidian-dev-utils/object-utils';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';
import { generateMarkdownLink } from 'obsidian-dev-utils/obsidian/link';

import type { GenerateMarkdownLinkExtendedOptions } from './generate-markdown-link-extended.d.ts';

export type GenerateMarkdownLinkNativeFn = FileManager['generateMarkdownLink'];

interface GenerateMarkdownLinkPatchComponentConstructorParams {
  readonly app: App;
  readonly fileManager: FileManager;
}

export class GenerateMarkdownLinkPatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly fileManager: FileManager;

  public constructor(params: GenerateMarkdownLinkPatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.fileManager = params.fileManager;
  }

  public override onload(): void {
    const app = this.app;

    this.registerMethodPatch({
      methodName: 'generateMarkdownLink',
      obj: this.fileManager,
      patchHandler: ({
        originalArgs: [file, sourcePath, subpath, alias]
      }) => {
        const options = removeUndefinedProperties(normalizeOptionalProperties<GenerateMarkdownLinkExtendedOptions>({
          alias,
          sourcePathOrFile: sourcePath,
          subpath,
          targetPathOrFile: file
        }));

        return generateMarkdownLink({
          app,
          ...options
        });
      },
      postPatchHandler: ({
        patchedMethod
      }) => {
        return Object.assign(patchedMethod, {
          extended(options: GenerateMarkdownLinkExtendedOptions): string {
            return generateMarkdownLink({
              app,
              ...options
            });
          }
        });
      }
    });
  }
}
