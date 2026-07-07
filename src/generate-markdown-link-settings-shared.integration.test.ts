/**
 * @file
 *
 * Shared integration suite that verifies each plugin setting genuinely changes the output of
 * `app.fileManager.generateMarkdownLink()` (and its `.extended()` overload). For every setting the
 * suite toggles it through the REAL settings component (`editAndSave`), regenerates the link, and
 * asserts the exact resulting markdown — proving the setting is actually wired into link generation
 * rather than silently ignored.
 *
 * The suite is registered by the platform-specific entry points
 * (`generate-markdown-link-settings.desktop.integration.test.ts`,
 * `generate-markdown-link-settings.android.integration.test.ts`) so the exact same behavior is
 * verified on both Desktop and mobile.
 *
 * This file is intentionally named `*.integration.test.ts` (matching the unit project's exclude
 * glob) so it is excluded from unit-test collection and coverage, yet not matched by any
 * `*.desktop`/`*.android` integration project glob — it only runs when imported by a platform entry
 * point.
 */

import type {
  App,
  SettingTab
} from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import type { GenerateMarkdownLinkExtendedWrapper } from './generate-markdown-link-extended.d.ts';
import type { PluginSettings } from './plugin-settings.ts';

/**
 * The augmented shape of `app.fileManager.generateMarkdownLink` after the plugin patches it.
 * It stays callable as the built-in overload and gains the `.extended(...)` method.
 */
type PatchedGenerateMarkdownLink =
  & App['fileManager']['generateMarkdownLink']
  & GenerateMarkdownLinkExtendedWrapper;

/**
 * The (otherwise protected) settings component exposed for the test, letting it change settings the
 * same way the plugin's own settings UI does.
 */
interface TestableSettingsComponent {
  editAndSave(settingsEditor: (settings: PluginSettings) => Promise<void> | void): Promise<void>;
}

/**
 * The plugin's settings tab, exposing its settings component.
 */
interface TestableSettingsTab extends SettingTab {
  readonly pluginSettingsComponent: TestableSettingsComponent;
}

const PLUGIN_ID = 'better-markdown-links';

const SOURCE_PATH = 'src.md';
const SOURCE_IN_FOLDER_PATH = 'folder/src2.md';
const TARGET_PATH = 'folder/target.md';
const TARGET_WITH_SPACE_PATH = 'folder/target with space.md';
const ATTACHMENT_PATH = 'folder/image.png';

/**
 * Parameters for {@link generate}.
 */
interface GenerateParams {
  /**
   * Whether to generate an embed link via the `.extended(...)` overload.
   *
   * @default `false`
   */
  readonly isEmbed?: boolean;

  /**
   * The Obsidian `newLinkFormat` config to apply before generating the link.
   */
  readonly newLinkFormat: 'absolute' | 'relative' | 'shortest';

  /**
   * The plugin settings to set before generating the link.
   */
  readonly settingsOverrides: Partial<PluginSettings>;

  /**
   * The source path passed to `generateMarkdownLink`.
   */
  readonly sourcePath: string;

  /**
   * The path of the target file to link to.
   */
  readonly targetPath: string;
}

/**
 * Registers the generate-markdown-link settings integration tests for the given platform.
 *
 * @param platform - Human-readable platform label used in test names (e.g. `'Desktop'`).
 */
export function registerGenerateMarkdownLinkSettingsSuite(platform: string): void {
  describe(`generateMarkdownLink settings (${platform})`, () => {
    beforeAll(async () => {
      await evalInObsidian({
        args: {
          attachmentPath: ATTACHMENT_PATH,
          markdownFiles: [
            { content: '', path: SOURCE_PATH },
            { content: '', path: SOURCE_IN_FOLDER_PATH },
            { content: '# target', path: TARGET_PATH },
            { content: '# target', path: TARGET_WITH_SPACE_PATH }
          ]
        },
        async fn({ app, attachmentPath, markdownFiles }) {
          const PNG_MAGIC_BYTES = [137, 80, 78, 71, 13, 10, 26, 10];

          for (const path of [...markdownFiles.map((file) => file.path), attachmentPath]) {
            const existing = app.vault.getAbstractFileByPath(path);
            if (existing) {
              // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup of stale test fixtures.
              await app.vault.delete(existing, true);
            }

            const folderPath = path.split('/').slice(0, -1).join('/');
            if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
              await app.vault.createFolder(folderPath);
            }
          }

          for (const file of markdownFiles) {
            await app.vault.create(file.path, file.content);
          }

          await app.vault.createBinary(attachmentPath, new Uint8Array(PNG_MAGIC_BYTES).buffer);
        },
        vaultPath: getTempVault().path
      });
    });

    it('should wrap markdown link paths in angle brackets only when the setting is enabled', async () => {
      const enabled = await generate({
        newLinkFormat: 'absolute',
        settingsOverrides: { shouldUseAngleBrackets: true, shouldUseLeadingSlashForAbsolutePaths: true },
        sourcePath: SOURCE_PATH,
        targetPath: TARGET_WITH_SPACE_PATH
      });
      const disabled = await generate({
        newLinkFormat: 'absolute',
        settingsOverrides: { shouldUseAngleBrackets: false, shouldUseLeadingSlashForAbsolutePaths: true },
        sourcePath: SOURCE_PATH,
        targetPath: TARGET_WITH_SPACE_PATH
      });

      expect(enabled).toBe('[target with space](</folder/target with space.md>)');
      expect(disabled).toBe('[target with space](/folder/target%20with%20space.md)');
    });

    it('should prepend a leading slash to absolute paths only when the setting is enabled', async () => {
      const enabled = await generate({
        newLinkFormat: 'absolute',
        settingsOverrides: { shouldUseAngleBrackets: false, shouldUseLeadingSlashForAbsolutePaths: true },
        sourcePath: SOURCE_PATH,
        targetPath: TARGET_PATH
      });
      const disabled = await generate({
        newLinkFormat: 'absolute',
        settingsOverrides: { shouldUseAngleBrackets: false, shouldUseLeadingSlashForAbsolutePaths: false },
        sourcePath: SOURCE_PATH,
        targetPath: TARGET_PATH
      });

      expect(enabled).toBe('[target](/folder/target.md)');
      expect(disabled).toBe('[target](folder/target.md)');
    });

    it('should prepend a leading dot to relative paths only when the setting is enabled', async () => {
      const enabled = await generate({
        newLinkFormat: 'relative',
        settingsOverrides: { shouldUseAngleBrackets: false, shouldUseLeadingDotForRelativePaths: true },
        sourcePath: SOURCE_IN_FOLDER_PATH,
        targetPath: TARGET_PATH
      });
      const disabled = await generate({
        newLinkFormat: 'relative',
        settingsOverrides: { shouldUseAngleBrackets: false, shouldUseLeadingDotForRelativePaths: false },
        sourcePath: SOURCE_IN_FOLDER_PATH,
        targetPath: TARGET_PATH
      });

      expect(enabled).toBe('[target](./target.md)');
      expect(disabled).toBe('[target](target.md)');
    });

    it('should allow an empty embed alias only when the setting is enabled', async () => {
      const enabled = await generate({
        isEmbed: true,
        newLinkFormat: 'absolute',
        settingsOverrides: {
          shouldAllowEmptyEmbedAlias: true,
          shouldIncludeAttachmentExtensionToEmbedAlias: false,
          shouldUseLeadingSlashForAbsolutePaths: false
        },
        sourcePath: SOURCE_PATH,
        targetPath: ATTACHMENT_PATH
      });
      const disabled = await generate({
        isEmbed: true,
        newLinkFormat: 'absolute',
        settingsOverrides: {
          shouldAllowEmptyEmbedAlias: false,
          shouldIncludeAttachmentExtensionToEmbedAlias: false,
          shouldUseLeadingSlashForAbsolutePaths: false
        },
        sourcePath: SOURCE_PATH,
        targetPath: ATTACHMENT_PATH
      });

      expect(enabled).toBe('![](folder/image.png)');
      expect(disabled).toBe('![image](folder/image.png)');
    });

    it('should include the attachment extension in the embed alias only when the setting is enabled', async () => {
      const enabled = await generate({
        isEmbed: true,
        newLinkFormat: 'absolute',
        settingsOverrides: {
          shouldAllowEmptyEmbedAlias: false,
          shouldIncludeAttachmentExtensionToEmbedAlias: true,
          shouldUseLeadingSlashForAbsolutePaths: false
        },
        sourcePath: SOURCE_PATH,
        targetPath: ATTACHMENT_PATH
      });
      const disabled = await generate({
        isEmbed: true,
        newLinkFormat: 'absolute',
        settingsOverrides: {
          shouldAllowEmptyEmbedAlias: false,
          shouldIncludeAttachmentExtensionToEmbedAlias: false,
          shouldUseLeadingSlashForAbsolutePaths: false
        },
        sourcePath: SOURCE_PATH,
        targetPath: ATTACHMENT_PATH
      });

      expect(enabled).toBe('![image.png](folder/image.png)');
      expect(disabled).toBe('![image](folder/image.png)');
    });
  });
}

/**
 * Applies the given Obsidian config + plugin settings inside Obsidian, then generates a markdown link
 * to the target file and returns the resulting markdown string.
 *
 * @param params - See {@link GenerateParams}.
 * @returns The generated markdown link.
 */
async function generate(params: GenerateParams): Promise<string> {
  return evalInObsidian({
    args: {
      isEmbed: params.isEmbed ?? false,
      newLinkFormat: params.newLinkFormat,
      pluginId: PLUGIN_ID,
      settingsOverrides: params.settingsOverrides,
      sourcePath: params.sourcePath,
      targetPath: params.targetPath
    },
    async fn({ app, isEmbed, newLinkFormat, pluginId, settingsOverrides, sourcePath, targetPath }): Promise<string> {
      app.vault.setConfig('useMarkdownLinks', true);
      app.vault.setConfig('newLinkFormat', newLinkFormat);

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        Object.assign(settings, settingsOverrides);
      });

      const targetFile = app.vault.getFileByPath(targetPath);
      if (!targetFile) {
        throw new Error(`Target file not found: ${targetPath}`);
      }

      const generateMarkdownLink = app.fileManager.generateMarkdownLink as PatchedGenerateMarkdownLink;
      if (typeof generateMarkdownLink.extended !== 'function') {
        throw new Error('generateMarkdownLink is not patched by the plugin (missing `.extended`)');
      }

      if (isEmbed) {
        return generateMarkdownLink.extended({
          isEmbed: true,
          sourcePathOrFile: sourcePath,
          targetPathOrFile: targetFile
        });
      }

      return generateMarkdownLink(targetFile, sourcePath);
    },
    vaultPath: getTempVault().path
  });
}
