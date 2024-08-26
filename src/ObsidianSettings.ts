import { Notice } from "obsidian";
import type BetterMarkdownLinksPlugin from "./BetterMarkdownLinksPlugin.ts";
import {
  shouldUseRelativeLinks,
  shouldUseWikilinks
} from "obsidian-dev-utils/obsidian/ObsidianSettings";

const warningNotice = new Notice("");
warningNotice.hide();

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
