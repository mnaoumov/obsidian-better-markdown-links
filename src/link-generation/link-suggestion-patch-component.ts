import type { FileSuggest } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  Editor,
  EditorChange,
  EditorSuggest,
  EditorTransaction,
  TFile
} from 'obsidian';

import {
  around,
  MonkeyAroundComponent
} from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { generateMarkdownLink } from '@mnaoumov/obsidian-lib/link';
import { parseLink } from '@mnaoumov/obsidian-lib/parse-link';
import { normalizeOptionalProperties } from '@mnaoumov/typescript-lib/object-utils';
import { parseLinktext } from 'obsidian';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { toGitHubHeadingAnchorLink } from '../github-heading-anchors/github-heading-anchor-link.ts';

/**
 * The origin Obsidian's link suggester passes to the one editor transaction that inserts the chosen link.
 */
const AUTOCOMPLETE_TRANSACTION_ORIGIN = 'input.autocomplete';

interface LinkSuggestionPatchComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface RewriteAutocompleteChangeParams {
  readonly app: App;
  readonly change: EditorChange;
  readonly cursorCh: number;
  readonly shouldUseGitHubHeadingAnchors: boolean;
  readonly sourcePath: string;
}

interface RewriteAutocompleteChangeResult {
  readonly cursorCh: number;
  readonly text: string;
}

interface RewriteAutocompleteTransactionParams {
  readonly app: App;
  readonly shouldUseGitHubHeadingAnchors: boolean;
  readonly sourcePath: string;
  readonly tx: EditorTransaction;
}

/**
 * Makes the `[[` autocomplete insert its link the way this plugin generates every other link (issue #46).
 *
 * Obsidian's link suggester builds the link text itself in `selectSuggestion` (`[text](encoded%20path)` or
 * `[[path|alias]]`) and never calls `fileManager.generateMarkdownLink`, so the settings that shape a generated link
 * (angle brackets, the leading dot or slash, the forced link style and path style, `GitHub` heading anchors) never
 * reached it. The suggester's insertion is one editor transaction with the origin `input.autocomplete`; for the
 * duration of `selectSuggestion` this component intercepts exactly that transaction and replaces the link it inserts
 * with one generated from the same target, subpath and caption.
 *
 * A link is only rewritten once the suggester has FINISHED it — the cursor lands right after it, or inside the empty
 * caption of a markdown block link. The intermediate links the suggester inserts when `#`, `^`, `|` or `Tab` is typed
 * (`[[note#]]`, with the cursor inside, to keep choosing) are left to it, and so is a link whose target does not
 * exist, which has no file to generate a path from.
 */
export class LinkSuggestionPatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: LinkSuggestionPatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    const linkSuggest = this.app.workspace.editorSuggest.suggests.find(isFileSuggest);
    if (!linkSuggest) {
      return;
    }

    this.registerMethodPatch({
      $object: linkSuggest,
      methodName: 'selectSuggestion',
      patchHandler: ({
        fallback,
        originalThis
      }) => {
        const context = originalThis.context;
        if (!context) {
          fallback();
          return;
        }

        const uninstall = this.patchAutocompleteTransaction(context.editor, context.file.path);
        try {
          fallback();
        } finally {
          uninstall();
        }
      }
    });
  }

  private patchAutocompleteTransaction(editor: Editor, sourcePath: string): () => void {
    const app = this.app;
    const shouldUseGitHubHeadingAnchors = this.pluginSettingsComponent.settings.shouldUseGitHubHeadingAnchors;

    return around(editor, {
      transaction: (next) =>
        function transactionPatched(this: Editor, tx: EditorTransaction, origin?: string): void {
          next.call(
            this,
            origin === AUTOCOMPLETE_TRANSACTION_ORIGIN ? rewriteAutocompleteTransaction({ app, shouldUseGitHubHeadingAnchors, sourcePath, tx }) : tx,
            origin
          );
        }
    });
  }
}

/**
 * Rewrites the link the suggester's transaction inserts, keeping the cursor where the suggester put it relative to the
 * link.
 *
 * The link is the transaction's FIRST change; a block link to a block that has no id yet carries a second one, which
 * appends the new id to that block and is left untouched.
 *
 * @param params - The transaction and the context to rewrite it in.
 * @returns The transaction to apply.
 */
export function rewriteAutocompleteTransaction(params: RewriteAutocompleteTransactionParams): EditorTransaction {
  const { tx } = params;
  const [change, ...otherChanges] = tx.changes ?? [];
  const selection = tx.selection;
  if (!change || !selection) {
    return tx;
  }

  const { from, to = from } = selection;
  if (to.line !== from.line || to.ch !== from.ch) {
    return tx;
  }

  const result = rewriteAutocompleteChange({
    app: params.app,
    change,
    cursorCh: from.ch,
    shouldUseGitHubHeadingAnchors: params.shouldUseGitHubHeadingAnchors,
    sourcePath: params.sourcePath
  });

  if (!result) {
    return tx;
  }

  const cursor = { ...from, ch: result.cursorCh };
  return {
    ...tx,
    changes: [{ ...change, text: result.text }, ...otherChanges],
    selection: { from: cursor, to: cursor }
  };
}

function isFileSuggest(suggest: EditorSuggest<unknown>): suggest is FileSuggest<unknown> {
  return 'suggestManager' in suggest;
}

function resolveTargetFile(app: App, linkPath: string, sourcePath: string): null | TFile {
  return linkPath === '' ? app.vault.getFileByPath(sourcePath) : app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
}

function rewriteAutocompleteChange(params: RewriteAutocompleteChangeParams): null | RewriteAutocompleteChangeResult {
  const { app, change, cursorCh, sourcePath } = params;
  const oldText = change.text;
  const linkStartCh = change.from.ch;
  const linkEndCh = linkStartCh + oldText.length;

  const parseLinkResult = parseLink(oldText);
  if (parseLinkResult?.raw !== oldText || parseLinkResult.isExternal || parseLinkResult.isEmbed) {
    return null;
  }

  const isEmptyMarkdownCaption = !parseLinkResult.isWikilink && !parseLinkResult.alias;
  const isCursorAfterLink = cursorCh === linkEndCh;
  const isCursorInEmptyCaption = isEmptyMarkdownCaption && cursorCh === linkStartCh + 1;
  if (!isCursorAfterLink && !isCursorInEmptyCaption) {
    return null;
  }

  const { path: linkPath, subpath } = parseLinktext(parseLinkResult.url);
  const targetFile = resolveTargetFile(app, linkPath, sourcePath);
  if (!targetFile) {
    return null;
  }

  const generatedLink = generateMarkdownLink(normalizeOptionalProperties<Parameters<typeof generateMarkdownLink>[0]>({
    alias: parseLinkResult.alias,
    app,
    isEmbed: false,
    sourcePathOrFile: sourcePath,
    subpath,
    targetPathOrFile: targetFile
  }));
  const text = params.shouldUseGitHubHeadingAnchors
    ? toGitHubHeadingAnchorLink({ app, linkText: generatedLink, targetFile })
    : generatedLink;

  const shouldKeepCursorInCaption = isCursorInEmptyCaption && text.startsWith('[](');
  return {
    cursorCh: linkStartCh + (shouldKeepCursorInCaption ? 1 : text.length),
    text
  };
}
