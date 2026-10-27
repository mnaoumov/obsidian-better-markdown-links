/**
 * @file
 *
 * The implementation behind this plugin's public API.
 *
 * Kept apart from `plugin-api.ts` so that file stays a plain description of the contract, with no runtime behavior in it.
 */

import type { App } from 'obsidian';

import { generateMarkdownLink } from '@mnaoumov/obsidian-lib/link';

import type {
  BetterMarkdownLinksApi,
  GenerateMarkdownLinkExtendedOptions
} from '../../api.d.ts';

import { toGenerateMarkdownLinkParams } from './generate-markdown-link-params.ts';

/**
 * Parameters for the {@link PluginApiImpl} constructor.
 */
export interface PluginApiImplConstructorParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;
}

/**
 * The published options type, re-spelled under the name the params-interface convention wants. It is an alias, so the
 * published name stays the one a consumer reads in `api.d.ts`.
 */
type PluginApiImplGenerateMarkdownLinkExtendedParams = GenerateMarkdownLinkExtendedOptions;

/**
 * This plugin's API, as it is actually implemented.
 */
export class PluginApiImpl implements BetterMarkdownLinksApi {
  private readonly app: App;

  /**
   * Creates the API.
   *
   * @param params - The parameters.
   */
  public constructor(params: PluginApiImplConstructorParams) {
    this.app = params.app;
  }

  /**
   * Generates a link the way this plugin generates links.
   *
   * @param params - The link to generate.
   * @returns The link's markdown.
   */
  public generateMarkdownLinkExtended(params: PluginApiImplGenerateMarkdownLinkExtendedParams): string {
    return generateMarkdownLink(toGenerateMarkdownLinkParams(this.app, params));
  }
}
