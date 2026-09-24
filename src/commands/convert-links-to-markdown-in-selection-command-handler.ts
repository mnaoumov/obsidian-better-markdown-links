import type { LinkConverter } from '../link-converter.ts';
import type { SelectionCommandHandlerExecuteSelectionParams } from './selection-command-handler.ts';

import { SelectionCommandHandler } from './selection-command-handler.ts';

interface ConvertLinksToMarkdownInSelectionCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

/**
 * Converts the links inside the editor selection, forcing the markdown style for this one run.
 *
 * Palette-only, deliberately: `Convert links in selection` already sits in the editor menu, and a second,
 * nearly identically named row beside it would cost more than it explains.
 */
export class ConvertLinksToMarkdownInSelectionCommandHandler extends SelectionCommandHandler {
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksToMarkdownInSelectionCommandHandlerConstructorParams) {
    super({
      icon: 'replace',
      id: 'convert-links-to-markdown-in-current-selection',
      name: 'Convert links to Markdown in current selection'
    });

    this.linkConverter = params.linkConverter;
  }

  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Override must keep the base param type.
  protected override async executeSelection(params: SelectionCommandHandlerExecuteSelectionParams): Promise<void> {
    await this.linkConverter.convertLinksInFile({
      file: params.file,
      offsetRange: params.offsetRange,
      shouldForceMarkdownLinkStyle: true,
      shouldPromptForExcludedFile: true,
      shouldResolveUnresolvedLinks: true
    });
  }
}
