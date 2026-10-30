import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/folder-command-handler';

import type { LinkConverter } from '../../conversion/link-converter.ts';

interface ConvertLinkPathsToRelativeInFolderCommandHandlerConstructorParams {
  readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the current folder, forcing the relative path style for this one run.
 *
 * Palette-only, for the reason given on {@link ConvertLinkPathsToRelativeInFileCommandHandler}.
 */
export class ConvertLinkPathsToRelativeInFolderCommandHandler extends FolderCommandHandler {
  private readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinkPathsToRelativeInFolderCommandHandlerConstructorParams) {
    super({
      icon: 'folder-tree',
      id: 'convert-link-paths-to-relative-in-current-folder',
      name: 'Convert link paths to relative in current folder'
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
          shouldForceRelativeLinkPathStyle: true,
          shouldResolveUnresolvedLinks: true
        });
      },
      summary: `Convert link paths to relative in ${folder.path}`
    });
  }
}
