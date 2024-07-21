import {
  App,
  Notice
} from "obsidian";
import type BetterMarkdownLinksPlugin from "./BetterMarkdownLinksPlugin.ts";

const warningNotice = new Notice("");
warningNotice.hide();

export function checkObsidianSettingsCompatibility(plugin: BetterMarkdownLinksPlugin): boolean {
  const app = plugin.app;

  if (plugin.settings.ignoreIncompatibleObsidianSettings) {
    return true;
  }

  if (!shouldUseWikilinks(app) && shouldUseRelativeLinks(app)) {
    return true;
  }

  plugin.showCompatibilityWarning();
  return false;
}

export function shouldUseWikilinks(app: App): boolean {
  return !app.vault.getConfig("useMarkdownLinks");
}

export function shouldUseRelativeLinks(app: App): boolean {
  return app.vault.getConfig("newLinkFormat") === "relative";
}
