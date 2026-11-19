import type { FileSuggest } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  Editor,
  EditorChange,
  EditorSuggest,
  EditorTransaction,
  TFile,
  TFolder
} from 'obsidian';

import {
  around,
  MonkeyAroundComponent
} from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import {
  generateMarkdownLink,
  hasWikilinkSyntax,
  LinkPathStyle,
  LinkStyle
} from '@mnaoumov/obsidian-lib/link';
import { parseLink } from '@mnaoumov/obsidian-lib/parse-link';
import { normalizeOptionalProperties } from '@mnaoumov/typescript-lib/object-utils';
import {
  FileView,
  getFrontMatterInfo,
  normalizePath,
  parseLinktext
} from 'obsidian';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { toGitHubHeadingAnchorLink } from '../github-heading-anchors/github-heading-anchor-link.ts';

/**
 * The origin Obsidian's link suggester passes to the one editor transaction that inserts the chosen link.
 */
const AUTOCOMPLETE_TRANSACTION_ORIGIN = 'input.autocomplete';

const MARKDOWN_FILE_SUFFIX = '.md';

/**
 * Where in a note's frontmatter the suggester inserts its link, when it inserts it there (issue #46 follow-up).
 */
export interface AutocompleteFrontmatterContext {
  /**
   * The quote the link is typed inside (`related: "[[x`), or `null` when the link is a plain YAML scalar.
   */
  readonly enclosingQuote: FrontmatterQuote | null;

  /**
   * The `shouldConvertFrontmatterWikilinksToMarkdown` setting.
   */
  readonly shouldConvertFrontmatterWikilinksToMarkdown: boolean;
}

type FrontmatterQuote = '"' | '\'';

interface GenerateAutocompleteLinkParams {
  readonly alias: string | undefined;
  readonly app: App;
  readonly isWikilinkForced: boolean;
  readonly isWikilinkInserted: boolean;
  readonly shouldUseGitHubHeadingAnchors: boolean;
  readonly sourcePath: string;
  readonly subpath: string;
  readonly targetFile: null | TFile;
  readonly targetPathOrFile: string | TFile;
}

interface GetAutocompleteFrontmatterContextParams {
  readonly editor: Editor;
  readonly shouldConvertFrontmatterWikilinksToMarkdown: boolean;
  readonly tx: EditorTransaction;
}

interface LinkSuggestionPatchComponentConstructorParams {
  readonly app: App;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface RewriteAutocompleteChangeParams {
  readonly app: App;
  readonly change: EditorChange;
  readonly cursorCh: number;
  readonly frontmatter: AutocompleteFrontmatterContext | null;
  readonly shouldUseGitHubHeadingAnchors: boolean;
  readonly sourcePath: string;
}

interface RewriteAutocompleteChangeResult {
  readonly cursorCh: number;
  readonly text: string;
}

interface RewriteAutocompleteTransactionParams {
  readonly app: App;

  /**
   * Set when the link is inserted into the note's frontmatter; absent or `null` for a link in the body.
   */
  readonly frontmatter?: AutocompleteFrontmatterContext | null;
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
 * (`[[note#]]`, with the cursor inside, to keep choosing) are left to it.
 *
 * A link to a note that does not exist yet is generated for the path core would create that note at when the link is
 * followed ({@link getNewNotePath}), always as that note's VAULT path, so `[[new note` + `Enter` in `folder/source.md`
 * writes `[](</folder/new note.md>)` (the leading slash is `shouldUseLeadingSlashForAbsolutePaths`) rather than core's
 * `[](new%20note)`. The configured path style is not applied to
 * it: core 1.15.1's `WorkspaceLeaf.openLinkText` resolves `./` and `../` only for a note that exists, and for a
 * missing one creates the note from the link path as written, from the vault root, so a relative link to a missing
 * note creates nothing (`./x.md`) or fails (`../x.md`, "outside the vault"). The vault path is the one form every
 * path style can follow; once the note exists, link conversion writes the link in the configured style.
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
        const sourcePath = context ? this.getSourcePath(context.file) : null;
        if (!context || sourcePath === null) {
          fallback();
          return;
        }

        const uninstall = this.patchAutocompleteTransaction(context.editor, sourcePath);
        try {
          fallback();
        } finally {
          uninstall();
        }
      }
    });
  }

  /**
   * The path the inserted link is generated relative to.
   *
   * The suggester's context carries no file in an editor that is not a note's own: a canvas text card (issue #46
   * follow-up) hands it `null`, though `EditorSuggestContext.file` is typed non-null. Links in a card resolve relative to
   * the canvas that holds it, and the card is edited in the active leaf, so that leaf's file is the source. With no file
   * there either, the link is left to core.
   *
   * @param contextFile - The file the suggester's context names, if any.
   * @returns The source path, or `null` to leave the link to core.
   */
  private getSourcePath(contextFile: null | TFile): null | string {
    return (contextFile ?? this.app.workspace.getActiveViewOfType(FileView)?.file)?.path ?? null;
  }

  private patchAutocompleteTransaction(editor: Editor, sourcePath: string): () => void {
    const app = this.app;
    const {
      shouldConvertFrontmatterWikilinksToMarkdown,
      shouldUseGitHubHeadingAnchors
    } = this.pluginSettingsComponent.settings;

    return around(editor, {
      transaction: (next) =>
        function transactionPatched(this: Editor, tx: EditorTransaction, origin?: string): void {
          next.call(
            this,
            origin === AUTOCOMPLETE_TRANSACTION_ORIGIN
              ? rewriteAutocompleteTransaction({
                app,
                frontmatter: getAutocompleteFrontmatterContext({ editor: this, shouldConvertFrontmatterWikilinksToMarkdown, tx }),
                shouldUseGitHubHeadingAnchors,
                sourcePath,
                tx
              })
              : tx,
            origin
          );
        }
    });
  }
}

/**
 * Tells whether the suggester's transaction inserts its link into the note's frontmatter, and inside which quote.
 *
 * @param params - The editor, before the transaction applies, and the transaction.
 * @returns The frontmatter context, or `null` for a link in the body.
 */
export function getAutocompleteFrontmatterContext(params: GetAutocompleteFrontmatterContextParams): AutocompleteFrontmatterContext | null {
  const { editor, tx } = params;
  const from = tx.changes?.[0]?.from;
  if (!from) {
    return null;
  }

  const frontmatterInfo = getFrontMatterInfo(editor.getValue());
  const offset = editor.posToOffset(from);
  if (!frontmatterInfo.exists || offset < frontmatterInfo.from || offset > frontmatterInfo.to) {
    return null;
  }

  const charBefore = editor.getLine(from.line).charAt(from.ch - 1);
  return {
    enclosingQuote: charBefore === '"' || charBefore === '\'' ? charBefore : null,
    shouldConvertFrontmatterWikilinksToMarkdown: params.shouldConvertFrontmatterWikilinksToMarkdown
  };
}

/**
 * The path of the note Obsidian creates when a link to a note that does not exist yet is followed, so a link the
 * suggester inserts for such a note can be generated in the configured style too.
 *
 * It mirrors core's `Workspace.openLinkText` and `FileManager.createNewMarkdownFileFromLinktext`: a link path with a
 * folder separator names a path from the vault root, any other one is placed in the folder the new-note location
 * setting picks (`getNewFileParent`), and `.md` is appended unless the path already ends with it.
 *
 * A path with a `.` or `..` segment answers `null`, leaving the link to core: core would not resolve those segments
 * when creating the note, so no path this function could answer would match the note core creates.
 *
 * @param app - The Obsidian app.
 * @param linkPath - The link path, decoded, without its subpath.
 * @param sourcePath - The path of the note the link is inserted into.
 * @returns The path of the note to link to, or `null` to leave the link to core.
 */
export function getNewNotePath(app: App, linkPath: string, sourcePath: string): null | string {
  const trimmedLinkPath = linkPath.trim();
  const segments = trimmedLinkPath.split('/');
  if (trimmedLinkPath === '' || segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  const parentPrefix = trimmedLinkPath.includes('/') ? '' : getParentPrefix(app.fileManager.getNewFileParent(sourcePath, trimmedLinkPath));
  const notePath = normalizePath(`${parentPrefix}${trimmedLinkPath}`);
  return notePath.toLowerCase().endsWith(MARKDOWN_FILE_SUFFIX) ? notePath : `${notePath}${MARKDOWN_FILE_SUFFIX}`;
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
    frontmatter: params.frontmatter ?? null,
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

/**
 * Generates the link that replaces the one the suggester inserted, in the configured style.
 *
 * @param params - The inserted link's parts and how to write it.
 * @returns The link text.
 */
function generateAutocompleteLink(params: GenerateAutocompleteLinkParams): string {
  const { app, targetFile, targetPathOrFile } = params;
  const targetPath = typeof targetPathOrFile === 'string' ? targetPathOrFile : targetPathOrFile.path;
  // Core's caption only repeats what a wikilink displays anyway, so it would be a redundant `|alias`.
  const isDefaultMarkdownCaption = params.isWikilinkForced && !params.isWikilinkInserted
    && params.alias === getDefaultMarkdownCaption(targetPath, params.subpath);
  const generatedLink = generateMarkdownLink(normalizeOptionalProperties<Parameters<typeof generateMarkdownLink>[0]>({
    alias: isDefaultMarkdownCaption ? undefined : params.alias,
    app,
    isEmbed: false,
    isNonExistingFileAllowed: targetFile ? undefined : true,
    linkPathStyle: targetFile ? undefined : LinkPathStyle.AbsolutePathInVault,
    linkStyle: params.isWikilinkForced ? LinkStyle.Wikilink : undefined,
    sourcePathOrFile: params.sourcePath,
    subpath: params.subpath,
    targetPathOrFile
  }));
  return params.shouldUseGitHubHeadingAnchors && targetFile
    ? toGitHubHeadingAnchorLink({ app, linkText: generatedLink, targetFile })
    : generatedLink;
}

/**
 * The caption core's link suggester gives a markdown link it inserts: the last heading or block of the subpath, else
 * the target's base name.
 *
 * @param targetPath - The target's path.
 * @param subpath - The link's subpath, with its leading `#`, or empty.
 * @returns The caption.
 */
function getDefaultMarkdownCaption(targetPath: string, subpath: string): string {
  const subpathParts = subpath.split('#').filter((part) => part !== '');
  return subpathParts.at(-1) ?? targetPath.replace(/^.*\//, '').replace(/\.md$/i, '');
}

function getParentPrefix(folder: TFolder): string {
  return folder.isRoot() ? '' : `${folder.path}/`;
}

function isFileSuggest(suggest: EditorSuggest<unknown>): suggest is FileSuggest<unknown> {
  return 'suggestManager' in suggest;
}

function resolveTargetFile(app: App, linkPath: string, sourcePath: string): null | TFile {
  return linkPath === '' ? app.vault.getFileByPath(sourcePath) : app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
}

function rewriteAutocompleteChange(params: RewriteAutocompleteChangeParams): null | RewriteAutocompleteChangeResult {
  const { app, change, cursorCh, frontmatter, sourcePath } = params;
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
  const targetPathOrFile = targetFile ?? getNewNotePath(app, linkPath, sourcePath);
  if (!targetPathOrFile) {
    return null;
  }

  const linkText = generateAutocompleteLink({
    alias: parseLinkResult.alias,
    app,
    // A link in the frontmatter is a wikilink, whatever core inserted (with `Use [[Wikilinks]]` off it inserts a
    // markdown link), because Bases reads a markdown link in a property as text; see `getLinkStyleForReference`.
    isWikilinkForced: frontmatter !== null && !frontmatter.shouldConvertFrontmatterWikilinksToMarkdown,
    isWikilinkInserted: parseLinkResult.isWikilink,
    shouldUseGitHubHeadingAnchors: params.shouldUseGitHubHeadingAnchors,
    sourcePath,
    subpath,
    targetFile,
    targetPathOrFile
  });
  const text = frontmatter ? toFrontmatterValueText(linkText, frontmatter.enclosingQuote) : linkText;
  if (text === null) {
    return null;
  }

  // The opening quote `toFrontmatterValueText` added, if any.
  const quotePrefixLength = text === linkText ? 0 : 1;
  const shouldKeepCursorInCaption = isCursorInEmptyCaption && text.startsWith('[](', quotePrefixLength);
  return {
    cursorCh: linkStartCh + (shouldKeepCursorInCaption ? quotePrefixLength + 1 : text.length),
    text
  };
}

/**
 * Makes a generated link safe as a YAML value.
 *
 * A wikilink is left as core writes it. A markdown link starts with `[`, which YAML reads as the start of a flow
 * sequence, so a plain-scalar one is written as a double-quoted string; inside a quote the user typed, it is written as
 * is, unless it contains a character that would end or escape that quote, in which case the link is left to core.
 *
 * @param text - The generated link.
 * @param enclosingQuote - The quote the link is typed inside, if any.
 * @returns The YAML-safe text, or `null` to leave the link to core.
 */
function toFrontmatterValueText(text: string, enclosingQuote: FrontmatterQuote | null): null | string {
  if (hasWikilinkSyntax(text)) {
    return text;
  }

  if (enclosingQuote === null) {
    return JSON.stringify(text);
  }

  const forbiddenCharacters = enclosingQuote === '"' ? ['"', '\\'] : ['\''];
  return forbiddenCharacters.some((character) => text.includes(character)) ? null : text;
}
