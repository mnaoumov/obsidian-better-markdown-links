/**
 * @file
 *
 * Drives the 5.0.0 rename/delete handover in a REAL Obsidian, which is the only place its two known
 * failure modes are visible — both were shipped and then found by a live run of the sibling plugin that
 * made this change first, and neither was visible to a unit test:
 *
 * 1. The migration component loads while the settings component, its sibling, is still reading `data.json`.
 *    Anything gated on the pending value at `onload` sees the DEFAULTS, so it registers nothing on exactly
 *    the vaults that have a value to migrate and loses the migration permanently.
 * 2. The pending value has to be retired with `editAndSave`, not `setProperty`. `setProperty` edits only
 *    the in-memory state, so an applied migration comes back on the next reload and is offered forever.
 *
 * Advanced Rename and Delete Handler is not installed in this vault, so the provider is a stub published
 * into `obsidian-dev-utils`' plugin-API registry under the real plugin id and contract version. That is
 * the seam this plugin actually talks to; the provider's own half of it is covered by that plugin's
 * `settings-migration` integration suite.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

const PLUGIN_ID = 'better-markdown-links';
const PROVIDER_PLUGIN_ID = 'advanced-rename-and-delete-handler';

const LEGACY_EXCLUDE_PATHS = ['/^Archive//'];
const LEGACY_INCLUDE_PATHS = ['Notes'];

/**
 * What the stub provider was offered, and what the plugin wrote to disk afterwards.
 */
interface HandoverProbeResult {
  readonly proposedExcludePaths: unknown;
  readonly proposedIncludePaths: unknown;
  readonly proposedShouldHandleRenames: unknown;
  readonly savedExcludePaths: unknown;
  readonly savedProposedShouldHandleRenames: unknown;
  readonly sourcePluginId: unknown;
  readonly wasOffered: boolean;
}

describe('the rename/delete handover (Desktop)', () => {
  it('should offer the legacy setting and its scope, and retire it to disk once applied', async () => {
    const result = await runHandover(true);

    expect(result.wasOffered).toBe(true);
    expect(result.sourcePluginId).toBe(PLUGIN_ID);
    expect(result.proposedShouldHandleRenames).toBe(false);
    expect(result.proposedIncludePaths).toEqual(LEGACY_INCLUDE_PATHS);
    expect(result.proposedExcludePaths).toEqual(LEGACY_EXCLUDE_PATHS);
    // Defect 2: written through `editAndSave`, so the retirement is on disk and the offer does not return.
    expect(result.savedProposedShouldHandleRenames).toBeNull();
    // The paths are proposed, not moved — this plugin keeps its own, which still scope link conversion.
    expect(result.savedExcludePaths).toEqual(LEGACY_EXCLUDE_PATHS);
  });

  it('should keep the value pending on disk when the user cancels', async () => {
    const result = await runHandover(false);

    expect(result.wasOffered).toBe(true);
    expect(result.savedProposedShouldHandleRenames).toBe(false);
  });
});

/**
 * Reloads the plugin against a vault whose `data.json` still carries the legacy rename setting, with a
 * stub provider already published — the ordering that exposes the load-time defect.
 *
 * @param isApplied - What the stub provider reports the user did with the dialog.
 * @returns See {@link HandoverProbeResult}.
 */
async function runHandover(isApplied: boolean): Promise<HandoverProbeResult> {
  return evalInObsidian({
    async callback({
      app,
      excludePaths,
      includePaths,
      isApplied: isMigrationApplied,
      pluginId,
      providerPluginId
    }): Promise<HandoverProbeResult> {
      const OFFER_WAIT_ATTEMPTS = 50;
      const OFFER_WAIT_INTERVAL_IN_MILLISECONDS = 100;
      const STATE_BAG_KEY = '__obsidianDevUtils';
      const REGISTRY_KEY = 'pluginApiRegistry';

      interface MigrateSettingsParamsLike {
        readonly proposedSettings: Record<string, unknown>;
        readonly sourcePluginId: string;
      }

      interface MigrateSettingsResultLike {
        readonly isApplied: boolean;
      }

      // A holder rather than a bare variable: the only assignment happens inside the stub the registry
      // Calls, which the compiler cannot see, so a bare variable would be narrowed to `null` at every read.
      interface OfferHolder {
        value: MigrateSettingsParamsLike | null;
      }

      interface RegistryRecord {
        api: unknown;
        apiVersion: string;
        contract: Record<string, unknown>;
        isRevoked: boolean;
        pluginId: string;
      }

      interface RegistryValue {
        records: Record<string, RegistryRecord[]>;
        subscribers: (() => void)[];
      }

      interface RegistryWrapper {
        value: Partial<RegistryValue>;
      }

      const dataPath = `.obsidian/plugins/${pluginId}/data.json`;
      const offerHolder: OfferHolder = { value: null };

      // The desktop project shares ONE Obsidian instance across its test files, so everything this scenario
      // Changes — the plugin's own `data.json` and the process-wide API registry — is put back before it
      // Returns. Leaving the seeded `includePaths` behind scopes the plugin to one folder and every later
      // Conversion test silently converts nothing.
      const originalData = await app.vault.adapter.exists(dataPath) ? await app.vault.adapter.read(dataPath) : null;

      // The plugin must not be running while `data.json` is rewritten underneath it, or its own save would
      // Put the defaults straight back.
      await app.plugins.disablePlugin(pluginId);

      await app.vault.adapter.write(
        dataPath,
        JSON.stringify({
          excludePaths,
          includePaths,
          shouldAutomaticallyUpdateLinksOnRenameOrMove: false
        })
      );

      // Published BEFORE the plugin loads, deliberately: that is the ordering in which the settings
      // Component is still reading from disk when the migration component wires itself up.
      const registry = getRegistryValue();
      registry.records[providerPluginId] = [{
        api: {
          migrateSettings(params: MigrateSettingsParamsLike): Promise<MigrateSettingsResultLike> {
            offerHolder.value = params;
            return Promise.resolve({ isApplied: isMigrationApplied });
          }
        },
        apiVersion: '1.0.0',
        contract: { migrateSettings: {} },
        isRevoked: false,
        pluginId: providerPluginId
      }];
      for (const subscriber of registry.subscribers) {
        subscriber();
      }

      await app.plugins.enablePlugin(pluginId);

      for (let attempt = 0; attempt < OFFER_WAIT_ATTEMPTS; attempt++) {
        if (offerHolder.value) {
          break;
        }

        await sleep(OFFER_WAIT_INTERVAL_IN_MILLISECONDS);
      }

      // Read back from disk rather than from the live settings, so an in-memory-only write is caught.
      const savedData = JSON.parse(await app.vault.adapter.read(dataPath)) as Record<string, unknown>;
      const acceptedOffer = offerHolder.value;

      await restoreSharedState();

      return {
        proposedExcludePaths: acceptedOffer?.proposedSettings['excludePaths'] ?? null,
        proposedIncludePaths: acceptedOffer?.proposedSettings['includePaths'] ?? null,
        proposedShouldHandleRenames: acceptedOffer?.proposedSettings['shouldHandleRenames'] ?? null,
        savedExcludePaths: savedData['excludePaths'] ?? null,
        savedProposedShouldHandleRenames: savedData['proposedShouldHandleRenames'] ?? null,
        sourcePluginId: acceptedOffer?.sourcePluginId ?? null,
        wasOffered: acceptedOffer !== null
      };

      // Puts the shared instance back the way it was found: the stub provider out of the registry, and the
      // Plugin reloaded off its original `data.json`.
      async function restoreSharedState(): Promise<void> {
        // Emptied rather than deleted: the registry reads `records[pluginId] ?? []`, so an empty list is
        // Indistinguishable from an absent one, and the key is dynamic.
        const currentRegistry = getRegistryValue();
        currentRegistry.records[providerPluginId] = [];
        for (const subscriber of currentRegistry.subscribers) {
          subscriber();
        }

        await app.plugins.disablePlugin(pluginId);
        if (originalData === null) {
          await app.vault.adapter.remove(dataPath);
        } else {
          await app.vault.adapter.write(dataPath, originalData);
        }

        await app.plugins.enablePlugin(pluginId);
      }

      // The registry is a `ValueWrapper` on the realm global, created lazily by whoever touches it first —
      // Here that is this test, since it publishes before the plugin loads.
      function getRegistryValue(): RegistryValue {
        let bag = Reflect.get(window, STATE_BAG_KEY) as Record<string, RegistryWrapper> | undefined;
        if (!bag) {
          bag = {};
          Reflect.set(window, STATE_BAG_KEY, bag);
        }

        let wrapper = bag[REGISTRY_KEY];
        if (!wrapper) {
          wrapper = { value: {} };
          bag[REGISTRY_KEY] = wrapper;
        }

        wrapper.value.records ??= {};
        wrapper.value.subscribers ??= [];
        return {
          records: wrapper.value.records,
          subscribers: wrapper.value.subscribers
        };
      }
    },
    input: {
      excludePaths: LEGACY_EXCLUDE_PATHS,
      includePaths: LEGACY_INCLUDE_PATHS,
      isApplied,
      pluginId: PLUGIN_ID,
      providerPluginId: PROVIDER_PLUGIN_ID
    },
    vaultPath: getTemporaryVault().path
  });
}
