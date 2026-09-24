import type {
  Editor,
  MarkdownFileInfo,
  TFile
} from 'obsidian';
import type { OffsetRange } from 'obsidian-dev-utils/obsidian/reference';

import { EditorCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/editor-command-handler';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

/**
 * Parameters for {@link SelectionCommandHandler.executeSelection}.
 */
export interface SelectionCommandHandlerExecuteSelectionParams {
  /**
   * The note the selection is in.
   */
  readonly file: TFile;

  /**
   * The selection, as a character range within the note's content.
   */
  readonly offsetRange: OffsetRange;
}

/**
 * The `in selection` scope, shared by every command that has one.
 *
 * Selection is a fourth scope beside file, folder and vault rather than a feature of each command: a
 * subclass only says which back-end call to make with the range, and everything the other scopes inherit —
 * the resource lock, the abort signal, the excluded-path prompt — comes from that back-end unchanged.
 *
 * A link only partly covered by the selection is left alone, because rewriting part of a link corrupts it.
 * So is any reference with no position in the note's body: frontmatter links, multi-value frontmatter
 * entries and every canvas reference can never be in a range.
 */
export abstract class SelectionCommandHandler extends EditorCommandHandler {
  /**
   * An empty selection greys the command out rather than meaning "the whole note": a command that silently
   * rewrote every link because nothing was selected is exactly the destructive surprise this scope exists
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

    await this.executeSelection({
      file,
      offsetRange: toOffsetRange(editor)
    });
  }

  /**
   * Runs the command's back-end over the selection.
   *
   * @param params - See {@link SelectionCommandHandlerExecuteSelectionParams}.
   * @returns A {@link Promise} that resolves when the selection has been processed.
   */
  protected abstract executeSelection(params: SelectionCommandHandlerExecuteSelectionParams): Promise<void>;
}

/**
 * Converts the editor selection into the character range dev-utils confines an edit to.
 *
 * **There is deliberately no off-by-one correction here.** Dev-utils tests containment as
 * `reference.position.end.offset <= endOffset`, and Obsidian's `position.end.offset` is the offset just
 * past the link's last character — exclusive, exactly like the editor's `to` cursor. The two exclusive
 * ends line up, so subtracting one would drop a link that ends precisely where the selection does.
 *
 * The offsets are read from the editor buffer while dev-utils rewrites the file on disk, and that is safe
 * without a flush here: every dev-utils edit saves a dirty `MarkdownView` for the file before reading it,
 * and what it saves is this very buffer, so the offsets still describe the content that reaches disk.
 */
function toOffsetRange(editor: Editor): OffsetRange {
  return {
    endOffset: editor.posToOffset(editor.getCursor('to')),
    startOffset: editor.posToOffset(editor.getCursor('from'))
  };
}
