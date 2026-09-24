import type {
  Editor,
  MarkdownFileInfo
} from 'obsidian';

import type { LinkConverter } from '../link-converter.ts';
import type { SelectionCommandHandlerExecuteSelectionParams } from './selection-command-handler.ts';

import { SelectionCommandHandler } from './selection-command-handler.ts';

interface ConvertLinksInSelectionCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

/**
 * Converts the links inside the editor selection, leaving the rest of the note alone.
 *
 * Frontmatter links are never in a selection, so this never touches them.
 */
export class ConvertLinksInSelectionCommandHandler extends SelectionCommandHandler {
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksInSelectionCommandHandlerConstructorParams) {
    super({
      editorMenuItemName: 'Convert links in selection',
      editorMenuSubmenuIcon: 'link-2',
      icon: 'link',
      id: 'convert-links-in-current-selection',
      name: 'Convert links in current selection',
      shouldAddCommandToSubmenu: true
    });

    this.linkConverter = params.linkConverter;
  }

  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Override must keep the base param type.
  protected override async executeSelection(params: SelectionCommandHandlerExecuteSelectionParams): Promise<void> {
    await this.linkConverter.convertLinksInFile({
      file: params.file,
      offsetRange: params.offsetRange,
      shouldPromptForExcludedFile: true,
      shouldResolveUnresolvedLinks: true
    });
  }

  protected override shouldAddToEditorMenu(editor: Editor, context: MarkdownFileInfo): boolean {
    return this.canExecuteEditor(editor, context);
  }
}
