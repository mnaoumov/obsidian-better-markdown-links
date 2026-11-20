/**
 * @file
 *
 * Integration suite proving that a plugin which patched `app.fileManager.generateMarkdownLink` BEFORE this
 * plugin loaded still chooses the alias of the link this plugin generates. The stand-in earlier patch is
 * installed while this plugin is disabled, so this plugin's patch lands on top of it, exactly as it does
 * after another plugin that loads earlier. Both of Obsidian's link formats are covered, because the alias is
 * read back out of the link core builds, and a wikilink and a markdown link carry it differently.
 */

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

const PLUGIN_ID = 'better-markdown-links';

interface Result {
  readonly withCallerAlias: string;
  readonly withEarlierAlias: string;
  readonly withoutEarlierPatch: string;
}

describe('an earlier generateMarkdownLink patch', () => {
  it.each([
    { useMarkdownLinks: false },
    { useMarkdownLinks: true }
  ])('should keep the alias an earlier patch set (useMarkdownLinks: $useMarkdownLinks)', async ({ useMarkdownLinks }) => {
    const result = await evalInObsidian({
      async callback({ app, pluginId, shouldUseMarkdownLinks }): Promise<Result> {
        const SOURCE_PATH = 'earlier-patch-source.md';
        const TARGET_PATH = 'earlier-patch-target.md';
        const EARLIER_ALIAS = 'Earlier Alias';

        for (const path of [SOURCE_PATH, TARGET_PATH]) {
          if (!app.vault.getAbstractFileByPath(path)) {
            await app.vault.create(path, '');
          }
        }
        const targetFile = app.vault.getFileByPath(TARGET_PATH);
        if (!targetFile) {
          throw new Error(`${TARGET_PATH} was not created`);
        }

        const originalUseMarkdownLinks = app.vault.getConfig('useMarkdownLinks');
        app.vault.setConfig('useMarkdownLinks', shouldUseMarkdownLinks);

        const fileManager = app.fileManager;
        await app.plugins.disablePlugin(pluginId);
        const hasOwnMethod = Object.hasOwn(fileManager, 'generateMarkdownLink');
        const below = fileManager.generateMarkdownLink;
        fileManager.generateMarkdownLink = function generateMarkdownLink(file, sourcePath, subpath, alias): string {
          return below.call(this, file, sourcePath, subpath, alias ?? EARLIER_ALIAS);
        };
        await app.plugins.enablePlugin(pluginId);

        let withCallerAlias: string;
        let withEarlierAlias: string;
        let withoutEarlierPatch: string;
        try {
          withEarlierAlias = app.fileManager.generateMarkdownLink(targetFile, SOURCE_PATH);
          withCallerAlias = app.fileManager.generateMarkdownLink(targetFile, SOURCE_PATH, undefined, 'Caller Alias');
        } finally {
          // This plugin's patch sits on top of the stand-in, so it has to come off before the stand-in does.
          await app.plugins.disablePlugin(pluginId);
          if (hasOwnMethod) {
            fileManager.generateMarkdownLink = below;
          } else {
            Reflect.deleteProperty(fileManager, 'generateMarkdownLink');
          }
          await app.plugins.enablePlugin(pluginId);
        }

        try {
          withoutEarlierPatch = app.fileManager.generateMarkdownLink(targetFile, SOURCE_PATH);
        } finally {
          app.vault.setConfig('useMarkdownLinks', originalUseMarkdownLinks);
        }

        return { withCallerAlias, withEarlierAlias, withoutEarlierPatch };
      },
      input: { pluginId: PLUGIN_ID, shouldUseMarkdownLinks: useMarkdownLinks }
    });

    expect(result.withEarlierAlias).toContain('Earlier Alias');
    expect(result.withCallerAlias).toContain('Caller Alias');
    expect(result.withCallerAlias).not.toContain('Earlier Alias');
    expect(result.withoutEarlierPatch).not.toContain('Earlier Alias');
  });
});
