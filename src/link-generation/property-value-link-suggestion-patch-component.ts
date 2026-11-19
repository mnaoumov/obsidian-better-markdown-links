import type { App } from 'obsidian';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { AbstractInputSuggest } from 'obsidian';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { rewritePropertyValueLink } from './link-suggestion-patch-component.ts';

/**
 * The value suggester of a `text` or `multitext` property in Obsidian's Properties panel (`PropertyValueSuggest` in
 * `obsidian-typings`), as far as this component reads it. Its class is not exported, so it is recognized by shape.
 */
export interface PropertyValueSuggest extends AbstractInputSuggest<PropertyValueSuggestItem> {
  /**
   * Gets the link query: the text between the opening `[[` and the closing `]]` or the caret.
   *
   * @param text - The text of the value input.
   * @returns The link query.
   */
  readonly getLinktextQuery: (text: string) => string;

  /**
   * Called with the value to commit when a suggestion is chosen.
   *
   * @param value - The value to commit.
   * @param event_ - The event that chose the suggestion.
   */
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Core assigns it per instance, and the patch swaps it for the duration of one call.
  onSelectLink: (value: string, event_: KeyboardEvent | MouseEvent) => void;

  /**
   * Commits a suggestion, or the typed value when `value` is `null` (`Shift+Enter`).
   *
   * @param value - The suggestion, or `null` for the typed value.
   * @param event_ - The event that chose the suggestion.
   */
  readonly selectSuggestion: (value: null | PropertyValueSuggestItem, event_: KeyboardEvent | MouseEvent) => void;

  /**
   * The path of the note whose property is edited.
   */
  readonly sourcePath: string;
}

/**
 * A suggestion of the Properties value suggester: a value the property already holds elsewhere (`text`), or a link
 * target (a file, heading, block or alias suggestion, each with its own `type`).
 */
export interface PropertyValueSuggestItem {
  readonly type: string;
}

interface PropertyValueLinkSuggestionPatchComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

/**
 * Makes the link suggester of Obsidian's Properties panel commit its link the way the `[[` autocomplete writes one in
 * the frontmatter (issue #46 follow-up).
 *
 * With Source mode off, a property value is edited in the Properties panel, whose own suggester builds the link
 * (`[[note]]`, always a wikilink) and commits it through `onSelectLink`; neither the editor's link suggester nor
 * `generateMarkdownLink` is involved, so `shouldConvertFrontmatterWikilinksToMarkdown` and the path style never reached
 * it. That suggester's class is not exported, so the first time one opens (`AbstractInputSuggest.open`), its class's
 * `selectSuggestion` is patched; for a chosen LINK suggestion, the value it commits is rewritten by
 * {@link rewritePropertyValueLink}. A value suggestion (`type: 'text'`) and `Shift+Enter` (the typed value) are left
 * alone, and so are the intermediate links `#` and `^` insert to keep choosing, which never reach `onSelectLink`.
 */
export class PropertyValueLinkSuggestionPatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly patchedPrototypes = new WeakSet<PropertyValueSuggest>();
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: PropertyValueLinkSuggestionPatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      $object: AbstractInputSuggest.prototype as AbstractInputSuggest<unknown>,
      methodName: 'open',
      patchHandler: ({ fallback, originalThis }) => {
        fallback();
        if (isPropertyValueSuggest(originalThis)) {
          this.patchPropertyValueSuggestClass(Object.getPrototypeOf(originalThis) as PropertyValueSuggest);
        }
      }
    });
  }

  private patchPropertyValueSuggestClass(prototype: PropertyValueSuggest): void {
    if (this.patchedPrototypes.has(prototype)) {
      return;
    }

    this.patchedPrototypes.add(prototype);
    this.registerMethodPatch({
      $object: prototype,
      methodName: 'selectSuggestion',
      patchHandler: ({ fallback, originalArguments: [value], originalThis }) => {
        if (value === null || value.type === 'text') {
          fallback();
          return;
        }

        const app = this.app;
        const { shouldConvertFrontmatterWikilinksToMarkdown, shouldUseGitHubHeadingAnchors } = this.pluginSettingsComponent.settings;
        const onSelectLink = originalThis.onSelectLink;
        originalThis.onSelectLink = (linkValue, event_): void => {
          onSelectLink.call(
            originalThis,
            rewritePropertyValueLink({
              app,
              shouldConvertFrontmatterWikilinksToMarkdown,
              shouldUseGitHubHeadingAnchors,
              sourcePath: originalThis.sourcePath,
              value: linkValue
            }),
            event_
          );
        };
        try {
          fallback();
        } finally {
          originalThis.onSelectLink = onSelectLink;
        }
      }
    });
  }
}

function isPropertyValueSuggest(suggest: AbstractInputSuggest<unknown>): suggest is PropertyValueSuggest {
  return 'getLinktextQuery' in suggest && 'onSelectLink' in suggest && 'sourcePath' in suggest;
}
