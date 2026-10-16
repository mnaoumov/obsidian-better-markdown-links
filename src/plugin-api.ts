/**
 * @file
 *
 * The runtime half of this plugin's published contract: the registry contract and its version.
 *
 * The TYPES are not declared here. They live in the repo-root `api.d.ts`, which is the file a consumer reads, and are imported
 * from it so there is exactly one declaration of each and nothing to drift.
 */

import type { PluginApiContract } from 'obsidian-dev-utils/obsidian/plugin/plugin-api';

/**
 * The contract this plugin publishes. It declares the method names; a consumer that wants schema validation at the boundary
 * supplies its own contract to `watchPluginApi`, and the consumer's wins.
 */
export const PLUGIN_API_CONTRACT: PluginApiContract = {
  generateMarkdownLinkExtended: {}
};

/**
 * The version of the contract above — independent of the plugin's own version, so a consumer asks for `'^1'` and keeps working
 * across releases that change nothing it depends on.
 *
 * `1.0.0` was published in plugin version 6.0.0, replacing the `generateMarkdownLink.extended` member the plugin used to hang off
 * Obsidian's own call.
 */
export const PLUGIN_API_VERSION = '1.0.0';
