import {
  getNewLinkFormat,
  shouldUseWikilinks
} from 'obsidian-dev-utils/obsidian/ObsidianSettings';

import type { Plugin } from './Plugin.ts';

export function checkObsidianSettingsCompatibility(plugin: Plugin): boolean {
  const app = plugin.app;

  if (plugin.settings.shouldIgnoreIncompatibleObsidianSettings) {
    return true;
  }

  if (!shouldUseWikilinks(app) && getNewLinkFormat(app) === 'relative') {
    return true;
  }

  plugin.showCompatibilityWarning();
  return false;
}
