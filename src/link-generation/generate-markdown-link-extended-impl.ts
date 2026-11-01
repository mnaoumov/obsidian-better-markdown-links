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

import type { GenerateMarkdownLinkExtendedOptions } from '../../api.d.ts';
import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { toGitHubHeadingAnchorLink } from '../github-heading-anchors/github-heading-anchor-link.ts';
import { toGenerateMarkdownLinkParams } from './generate-markdown-link-params.ts';

interface GenerateMarkdownLinkPatchComponentConstructorParams {
  readonly app: App;
  readonly fileManager: FileManager;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class GenerateMarkdownLinkPatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly fileManager: FileManager;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: GenerateMarkdownLinkPatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.fileManager = params.fileManager;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
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

        const link = generateMarkdownLink(toGenerateMarkdownLinkParams(app, options));
        return this.pluginSettingsComponent.settings.shouldUseGitHubHeadingAnchors
          ? toGitHubHeadingAnchorLink({ app, linkText: link, targetFile: file })
          : link;
      }
    });
  }
}
