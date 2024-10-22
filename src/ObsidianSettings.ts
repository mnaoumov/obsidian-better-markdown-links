import {
  shouldUseRelativeLinks,
  shouldUseWikilinks
} from 'obsidian-dev-utils/obsidian/ObsidianSettings';

import type BetterMarkdownLinksPlugin from './BetterMarkdownLinksPlugin.ts';

export function checkObsidianSettingsCompatibility(plugin: BetterMarkdownLinksPlugin): boolean {
  const app = plugin.app;

  if (plugin.settingsCopy.ignoreIncompatibleObsidianSettings) {
    return true;
  }

  if (!shouldUseWikilinks(app) && shouldUseRelativeLinks(app)) {
    return true;
  }

  plugin.showCompatibilityWarning();
  return false;
}
