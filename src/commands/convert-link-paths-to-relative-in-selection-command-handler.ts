import type { LinkConverter } from '../link-converter.ts';
import type { SelectionCommandHandlerExecuteSelectionParams } from './selection-command-handler.ts';

import { SelectionCommandHandler } from './selection-command-handler.ts';

interface ConvertLinkPathsToRelativeInSelectionCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

/**
 * Converts the links inside the editor selection, forcing the relative path style for this one run.
 *
 * Palette-only, deliberately: `Convert links in selection` already sits in the editor menu, and a second,
 * nearly identically named row beside it would cost more than it explains.
 */
export class ConvertLinkPathsToRelativeInSelectionCommandHandler extends SelectionCommandHandler {
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinkPathsToRelativeInSelectionCommandHandlerConstructorParams) {
    super({
      icon: 'folder-tree',
      id: 'convert-link-paths-to-relative-in-current-selection',
      name: 'Convert link paths to relative in current selection'
    });

    this.linkConverter = params.linkConverter;
  }

  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Override must keep the base param type.
  protected override async executeSelection(params: SelectionCommandHandlerExecuteSelectionParams): Promise<void> {
    await this.linkConverter.convertLinksInFile({
      file: params.file,
      offsetRange: params.offsetRange,
      shouldForceRelativeLinkPathStyle: true,
      shouldPromptForExcludedFile: true,
      shouldResolveUnresolvedLinks: true
    });
  }
}
