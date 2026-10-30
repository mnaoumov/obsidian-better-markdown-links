import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/folder-command-handler';

import type { LinkConverter } from '../../conversion/link-converter.ts';

interface ConvertLinksToMarkdownInFolderCommandHandlerConstructorParams {
  readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the current folder, forcing the markdown style for this one run.
 *
 * Palette-only, for the reason given on {@link ConvertLinksToMarkdownInFileCommandHandler}.
 */
export class ConvertLinksToMarkdownInFolderCommandHandler extends FolderCommandHandler {
  private readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksToMarkdownInFolderCommandHandlerConstructorParams) {
    super({
      icon: 'replace',
      id: 'convert-links-to-markdown-in-current-folder',
      name: 'Convert links to Markdown in current folder'
    });

    this.bulkOperationCommitComponent = params.bulkOperationCommitComponent;
    this.linkConverter = params.linkConverter;
  }

  protected override canExecuteFolder(): boolean {
    return true;
  }

  protected override async executeFolder(folder: TFolder): Promise<void> {
    await this.bulkOperationCommitComponent.runBulkOperation({
      operation: async () => {
        await this.linkConverter.convertLinksInFolder({
          folder,
          shouldForceMarkdownLinkStyle: true,
          shouldResolveUnresolvedLinks: true
        });
      },
      summary: `Convert links to Markdown in ${folder.path}`
    });
  }
}
