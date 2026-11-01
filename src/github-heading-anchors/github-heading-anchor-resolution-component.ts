import type {
  EmbedContext,
  EmbedCreator,
  MarkdownViewEphemeralState
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  HeadingCache,
  TFile
} from 'obsidian';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { MarkdownView } from 'obsidian';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import {
  findHeadingByGitHubAnchor,
  findHeadingByObsidianSubpath,
  translateGitHubAnchorToObsidianSubpath
} from './github-heading-slug.ts';

interface GitHubHeadingAnchorResolutionComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

/**
 * Makes Obsidian follow a link whose subpath is a GitHub anchor, such as `[x](note.md#my-heading)`.
 *
 * Core resolves a subpath only by heading text, in a function plugins cannot reach, so the anchor is translated
 * where a subpath ENTERS that function instead, and only when core would find nothing by it:
 *
 * - `MarkdownView.setEphemeralState`, which every navigation to a note goes through. The anchor's heading is
 *   handed over as the line to scroll to, exactly as core would hand over its own match, so even a heading
 *   whose text repeats under the same parent is reached.
 * - The creator `EmbedRegistry.getEmbedCreator` returns for a note, which renders both an embed and a hover
 *   preview. That creator takes a subpath, so the anchor becomes the Obsidian subpath of its heading.
 *
 * Both consult the setting at call time, so turning it off needs no reload.
 */
export class GitHubHeadingAnchorResolutionComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: GitHubHeadingAnchorResolutionComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      $object: MarkdownView.prototype,
      methodName: 'setEphemeralState',
      patchHandler: ({
        originalArguments: [state],
        originalMethod,
        originalThis
      }) => {
        originalMethod.call(originalThis, this.resolveEphemeralState(originalThis.file, state));
      }
    });

    this.registerMethodPatch({
      $object: this.app.embedRegistry,
      methodName: 'getEmbedCreator',
      patchHandler: ({
        fallback
      }) => {
        const embedCreator = fallback();
        return embedCreator ? this.wrapEmbedCreator(embedCreator) : embedCreator;
      }
    });
  }

  private getHeadings(file: null | TFile): null | readonly HeadingCache[] {
    if (!this.pluginSettingsComponent.settings.isGitHubHeadingAnchorResolutionEnabled()) {
      return null;
    }

    return file?.extension === 'md' ? this.app.metadataCache.getFileCache(file)?.headings ?? null : null;
  }

  private resolveEphemeralState(file: null | TFile, state: Partial<MarkdownViewEphemeralState>): Partial<MarkdownViewEphemeralState> {
    const subpath = state.subpath;
    const headings = this.getHeadings(file);
    if (!subpath || !headings || findHeadingByObsidianSubpath(headings, subpath)) {
      return state;
    }

    const target = findHeadingByGitHubAnchor(headings, subpath);
    if (!target) {
      return state;
    }

    // Exactly what core sets for a subpath it resolves itself. The subpath goes, so core does not look it up again.
    const { subpath: _subpath, ...rest } = state;
    return {
      ...rest,
      endLoc: target.next?.position.start ?? null,
      line: target.heading.position.start.line,
      startLoc: target.heading.position.start
    };
  }

  private wrapEmbedCreator(embedCreator: EmbedCreator): EmbedCreator {
    return (context: EmbedContext, file: TFile, subpath?: string) => {
      const headings = subpath ? this.getHeadings(file) : null;
      const translatedSubpath = subpath && headings ? translateGitHubAnchorToObsidianSubpath(headings, subpath) : null;
      return embedCreator(context, file, translatedSubpath ?? subpath);
    };
  }
}
