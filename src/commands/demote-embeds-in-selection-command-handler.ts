import type {
  Editor,
  MarkdownFileInfo
} from 'obsidian';
import type { OffsetRange } from 'obsidian-dev-utils/obsidian/reference';

import { EditorCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/editor-command-handler';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

import type { EmbedDemoter } from '../embed-demoter.ts';

interface DemoteEmbedsInSelectionCommandHandlerConstructorParams {
  readonly embedDemoter: EmbedDemoter;
}

/**
 * Demotes the embeds inside the editor selection, leaving the rest of the note alone.
 *
 * Selection is a fourth scope beside file, folder and vault rather than a feature of its own: the work is
 * still {@link EmbedDemoter.demoteEmbedsInFile}, handed a character range. Everything the other scopes
 * inherit — the resource lock, the abort signal, the excluded-path prompt — is inherited here unchanged.
 *
 * An embed only partly covered by the selection is left alone, because rewriting part of a link corrupts
 * it. So is any reference with no position in the note's body: frontmatter links, multi-value frontmatter
 * entries and every canvas reference can never be in a range, which makes this command a no-op on a canvas.
 */
export class DemoteEmbedsInSelectionCommandHandler extends EditorCommandHandler {
  private readonly embedDemoter: EmbedDemoter;

  public constructor(params: DemoteEmbedsInSelectionCommandHandlerConstructorParams) {
    super({
      editorMenuItemName: 'Demote embeds to links in selection',
      editorMenuSubmenuIcon: 'link-2',
      icon: 'link',
      id: 'demote-embeds-to-links-in-current-selection',
      name: 'Demote embeds to links in current selection',
      shouldAddCommandToSubmenu: true
    });

    this.embedDemoter = params.embedDemoter;
  }

  /**
   * An empty selection greys the command out rather than meaning "the whole note": a command that silently
   * rewrote every embed because nothing was selected is exactly the destructive surprise this scope exists
   * to avoid. The whole-note gesture already has its own command.
   */
  protected override canExecuteEditor(editor: Editor, context: MarkdownFileInfo): boolean {
    return isMarkdownFile(context.file) && editor.somethingSelected();
  }

  protected override async executeEditor(editor: Editor, context: MarkdownFileInfo): Promise<void> {
    const file = context.file;
    if (!file) {
      return;
    }

    await this.embedDemoter.demoteEmbedsInFile({
      file,
      offsetRange: toOffsetRange(editor),
      shouldPromptForExcludedFile: true
    });
  }

  protected override shouldAddToEditorMenu(editor: Editor, context: MarkdownFileInfo): boolean {
    return this.canExecuteEditor(editor, context);
  }
}

/**
 * Converts the editor selection into the character range {@link EmbedDemoter} passes to dev-utils.
 *
 * **There is deliberately no off-by-one correction here.** Dev-utils tests containment as
 * `reference.position.end.offset <= endOffset`, and Obsidian's `position.end.offset` is the offset just
 * past the link's last character — exclusive, exactly like the editor's `to` cursor. The two exclusive
 * ends line up, so subtracting one would drop a link that ends precisely where the selection does.
 *
 * The offsets are read from the editor buffer while dev-utils rewrites the file on disk, and that is safe
 * without a flush here: `editLinks` saves a dirty `MarkdownView` for the file before reading it, and what
 * it saves is this very buffer, so the offsets still describe the content that reaches disk.
 */
function toOffsetRange(editor: Editor): OffsetRange {
  return {
    endOffset: editor.posToOffset(editor.getCursor('to')),
    startOffset: editor.posToOffset(editor.getCursor('from'))
  };
}
