import type {
  Editor,
  MarkdownFileInfo
} from 'obsidian';

import type { EmbedDemoter } from '../embed-demoter.ts';
import type { SelectionCommandHandlerExecuteSelectionParams } from './selection-command-handler.ts';

import { SelectionCommandHandler } from './selection-command-handler.ts';

interface DemoteEmbedsInSelectionCommandHandlerConstructorParams {
  readonly embedDemoter: EmbedDemoter;
}

/**
 * Demotes the embeds inside the editor selection, leaving the rest of the note alone.
 *
 * A no-op on a canvas, whose references carry no position a selection could contain.
 */
export class DemoteEmbedsInSelectionCommandHandler extends SelectionCommandHandler {
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

  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Override must keep the base param type.
  protected override async executeSelection(params: SelectionCommandHandlerExecuteSelectionParams): Promise<void> {
    await this.embedDemoter.demoteEmbedsInFile({
      file: params.file,
      offsetRange: params.offsetRange,
      shouldPromptForExcludedFile: true
    });
  }

  protected override shouldAddToEditorMenu(editor: Editor, context: MarkdownFileInfo): boolean {
    return this.canExecuteEditor(editor, context);
  }
}
