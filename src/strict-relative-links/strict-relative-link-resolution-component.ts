import type { App } from 'obsidian';

import { registerAsyncEvent } from '@mnaoumov/obsidian-lib/components/async-events-component';
import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { resolveLinkPathStrictly } from './strict-link-resolution.ts';

interface StrictRelativeLinkResolutionComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

/**
 * Makes Obsidian resolve a link only relative to the note holding it, or as an exact vault path, while
 * `shouldResolveLinksStrictly` is on. See {@link resolveLinkPathStrictly}.
 *
 * Core's link resolution is not configurable, so the patch sits on `MetadataCache.getLinkpathDest`, which
 * `getFirstLinkpathDest` calls: one place, behind which are navigation, embeds, hover previews, the resolved
 * and unresolved link tables that backlinks and the graph read, and every plugin asking where a link leads.
 *
 * The setting is consulted at call time, so turning it on or off needs no reload. The link tables are built
 * ahead of time, though, so a change of the setting queues every note for link resolution again.
 */
export class StrictRelativeLinkResolutionComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: StrictRelativeLinkResolutionComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      $object: this.app.metadataCache,
      methodName: 'getLinkpathDest',
      patchHandler: ({
        fallback,
        originalArguments: [linkPath, sourcePath]
      }) => {
        const strictlyResolvedFiles = this.pluginSettingsComponent.settings.shouldResolveLinksStrictly
          ? resolveLinkPathStrictly(this.app.vault, linkPath, sourcePath)
          : null;
        return strictlyResolvedFiles ?? fallback();
      }
    });

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('saveSettings', (newState, oldState) => {
        if (newState.effectiveValues.shouldResolveLinksStrictly !== oldState.effectiveValues.shouldResolveLinksStrictly) {
          this.resolveAllLinksAgain();
        }
      })
    );

    if (this.pluginSettingsComponent.settings.shouldResolveLinksStrictly) {
      this.resolveAllLinksAgain();
    }
  }

  public override onunload(): void {
    super.onunload();

    if (this.pluginSettingsComponent.settings.shouldResolveLinksStrictly) {
      this.resolveAllLinksAgain();
    }
  }

  private resolveAllLinksAgain(): void {
    const { metadataCache, vault } = this.app;
    for (const path of metadataCache.getCachedFiles()) {
      const file = vault.getFileByPath(path);
      if (file) {
        metadataCache.queueFileForLinkResolution(file);
      }
    }
  }
}
