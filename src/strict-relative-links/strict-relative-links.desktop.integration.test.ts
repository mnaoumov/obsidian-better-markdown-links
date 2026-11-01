/**
 * @file
 *
 * Integration suite for `shouldResolveLinksStrictly` against a real Obsidian. With it on, a link resolves only
 * relative to the note holding it or as an exact vault path, never to a same-named note in another folder:
 * - `getFirstLinkpathDest`, which every caller asking where a link leads goes through,
 * - the resolved and unresolved link tables backlinks and the graph read, rebuilt when the setting changes.
 *
 * With it off again, core's vault-wide name match comes back, so the patch stands aside entirely.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import type { SettingTab } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from '../settings/plugin-settings.ts';

/**
 * What the scenario observed, one entry per setting state.
 */
interface ObservedResolution {
  readonly firstDestinations: Record<string, null | string>;
  readonly resolvedLinks: string[];
  readonly unresolvedLinks: string[];
}

interface ScenarioResult {
  readonly off: ObservedResolution;
  readonly offAgain: ObservedResolution;
  readonly on: ObservedResolution;
}

/**
 * The (otherwise protected) settings component exposed for the test, letting it change settings the
 * same way the plugin's own settings UI does.
 */
interface TestableSettingsComponent {
  readonly editAndSave: (settingsEditor: (settings: PluginSettings) => Promise<void> | void) => Promise<void>;
}

/**
 * The plugin's settings tab, exposing its settings component.
 */
interface TestableSettingsTab extends SettingTab {
  readonly pluginSettingsComponent: TestableSettingsComponent;
}

const PLUGIN_ID = 'better-markdown-links';

describe('strict relative link resolution (Desktop)', () => {
  it('should resolve only relative to the note or as a vault path while the setting is on', async () => {
    const result = await runScenario();

    expect(result.off).toEqual({
      firstDestinations: {
        'issues': 'strict-links/a/issues.md',
        'only-in-b': 'strict-links/b/only-in-b.md',
        'strict-links-root': 'strict-links-root.md'
      },
      resolvedLinks: ['strict-links-root.md', 'strict-links/a/issues.md', 'strict-links/b/only-in-b.md'],
      unresolvedLinks: []
    });

    expect(result.on).toEqual({
      firstDestinations: {
        'issues': 'strict-links/a/issues.md',
        'only-in-b': null,
        'strict-links-root': 'strict-links-root.md'
      },
      resolvedLinks: ['strict-links-root.md', 'strict-links/a/issues.md'],
      unresolvedLinks: ['only-in-b']
    });

    expect(result.offAgain).toEqual(result.off);
  });
});

/**
 * Builds the notes, then reads how the source note's links resolve with the setting off, on, and off again.
 *
 * @returns What each state resolved to.
 */
async function runScenario(): Promise<ScenarioResult> {
  return evalInObsidian({
    async callback({ app, pluginId }): Promise<ScenarioResult> {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 5000;
      const SETTLE_POLL_INTERVAL_IN_MILLISECONDS = 100;
      const SOURCE_PATH = 'strict-links/a/source.md';
      const LINK_PATHS = ['issues', 'only-in-b', 'strict-links-root'];
      const TARGET_FILES: Record<string, string> = {
        'strict-links-root.md': 'Root\n',
        'strict-links/a/issues.md': 'A issues\n',
        'strict-links/b/issues.md': 'B issues\n',
        'strict-links/b/only-in-b.md': 'Only in B\n'
      };
      const SOURCE_CONTENT = LINK_PATHS.map((linkPath) => `[[${linkPath}]]`).join('\n\n');

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      const { pluginSettingsComponent } = settingTab as TestableSettingsTab;

      await setStrict(false);

      for (const folderPath of ['strict-links/a', 'strict-links/b']) {
        if (!app.vault.getAbstractFileByPath(folderPath)) {
          await app.vault.createFolder(folderPath);
        }
      }

      // The source note last, so every link in it has its target in place when it is first resolved.
      for (const [path, content] of [...Object.entries(TARGET_FILES), [SOURCE_PATH, SOURCE_CONTENT]] as const) {
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }

        await app.vault.create(path, content);
      }

      try {
        const off = await observe(['strict-links-root.md', 'strict-links/a/issues.md', 'strict-links/b/only-in-b.md']);
        await setStrict(true);
        const on = await observe(['strict-links-root.md', 'strict-links/a/issues.md']);
        await setStrict(false);
        const offAgain = await observe(['strict-links-root.md', 'strict-links/a/issues.md', 'strict-links/b/only-in-b.md']);
        return { off, offAgain, on };
      } finally {
        await setStrict(false);
      }

      async function setStrict(isStrict: boolean): Promise<void> {
        await pluginSettingsComponent.editAndSave((settings) => {
          settings.shouldResolveLinksStrictly = isStrict;
        });
      }

      // Waits until the source note's resolved links are the expected ones, then reads everything once.
      async function observe(expectedResolvedLinks: string[]): Promise<ObservedResolution> {
        const start = performance.now();
        while (performance.now() - start < SETTLE_TIMEOUT_IN_MILLISECONDS) {
          if (JSON.stringify(readResolvedLinks()) === JSON.stringify(expectedResolvedLinks)) {
            break;
          }

          await sleep(SETTLE_POLL_INTERVAL_IN_MILLISECONDS);
        }

        const firstDestinations: Record<string, null | string> = {};
        for (const linkPath of LINK_PATHS) {
          firstDestinations[linkPath] = app.metadataCache.getFirstLinkpathDest(linkPath, SOURCE_PATH)?.path ?? null;
        }

        return {
          firstDestinations,
          resolvedLinks: readResolvedLinks(),
          unresolvedLinks: Object.keys(app.metadataCache.unresolvedLinks[SOURCE_PATH] ?? {}).sort()
        };
      }

      function readResolvedLinks(): string[] {
        return Object.keys(app.metadataCache.resolvedLinks[SOURCE_PATH] ?? {}).sort();
      }
    },
    input: {
      pluginId: PLUGIN_ID
    },
    vaultPath: getTemporaryVault().path
  });
}
