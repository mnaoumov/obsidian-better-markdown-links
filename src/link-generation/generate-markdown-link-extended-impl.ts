import type {
  App,
  FileManager,
  TFile
} from 'obsidian';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { generateMarkdownLink } from '@mnaoumov/obsidian-lib/link';
import { parseLink } from '@mnaoumov/obsidian-lib/parse-link';
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

interface GetEarlierPatchAliasParams {
  readonly alias: string | undefined;
  readonly fallback: () => string;
  readonly file: TFile;
  readonly fileManager: FileManager;
  readonly sourcePath: string;
  readonly subpath: string | undefined;
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
    const fileManager = this.fileManager;

    this.registerMethodPatch({
      $object: this.fileManager,
      methodName: 'generateMarkdownLink',
      patchHandler: ({
        fallback,
        originalArguments: [file, sourcePath, subpath, alias]
      }) => {
        const options = removeUndefinedProperties(normalizeOptionalProperties<GenerateMarkdownLinkExtendedOptions>({
          alias: getEarlierPatchAlias({ alias, fallback, file, fileManager, sourcePath, subpath }) ?? alias,
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

/**
 * Lets a plugin that patched `generateMarkdownLink` BEFORE this one still choose the link's display text.
 *
 * This patch builds the link itself, so the method it wraps is not what produces the result. A plugin
 * that patched the method earlier (to set an alias, such as an attachment's original name or a pasted
 * image's size) would otherwise be skipped. So, when the wrapped method is not core's own, it is called,
 * and so is core's own method with the same arguments; an alias that differs between the two links is
 * the earlier patch's contribution, and it is handed to this plugin's generator. Everything else about
 * the link (its style, path and angle brackets) is still decided by this plugin's settings.
 *
 * @param params - The intercepted call.
 * @returns The alias an earlier patch chose, or `null` when no earlier patch changed the alias.
 */
function getEarlierPatchAlias(params: GetEarlierPatchAliasParams): null | string {
  const { alias, fallback, file, fileManager, sourcePath, subpath } = params;
  const coreMethod = (Object.getPrototypeOf(fileManager) as null | Partial<FileManager>)?.generateMarkdownLink;
  if (typeof coreMethod !== 'function') {
    return null;
  }

  const chainLink = fallback();
  const coreLink = coreMethod.call(fileManager, file, sourcePath, subpath, alias);
  if (chainLink === coreLink) {
    return null;
  }

  const chainAlias = getLinkAlias(chainLink);
  const coreAlias = getLinkAlias(coreLink);
  return chainAlias === coreAlias ? null : chainAlias;
}

function getLinkAlias(link: string): null | string {
  // A wikilink's alias carries no markdown escapes, so `parseLink` reports it only as `alias`.
  const parseLinkResult = parseLink(link);
  return parseLinkResult?.unescapedAlias ?? parseLinkResult?.alias ?? null;
}
