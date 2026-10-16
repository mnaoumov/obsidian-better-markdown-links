import type {
  App,
  FileManager
} from 'obsidian';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { generateMarkdownLink } from '@mnaoumov/obsidian-lib/link';
import {
  normalizeOptionalProperties,
  removeUndefinedProperties
} from '@mnaoumov/typescript-lib/object-utils';

import type { GenerateMarkdownLinkExtendedOptions } from '../api.d.ts';

import { toGenerateMarkdownLinkParams } from './generate-markdown-link-params.ts';

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
      $object: this.fileManager,
      methodName: 'generateMarkdownLink',
      patchHandler: ({
        originalArguments: [file, sourcePath, subpath, alias]
      }) => {
        const options = removeUndefinedProperties(normalizeOptionalProperties<GenerateMarkdownLinkExtendedOptions>({
          alias,
          sourcePathOrFile: sourcePath,
          subpath,
          targetPathOrFile: file
        }));

        return generateMarkdownLink(toGenerateMarkdownLinkParams(app, options));
      }
    });
  }
}
