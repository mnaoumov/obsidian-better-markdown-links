import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/folder-command-handler';

import { LinkConverter } from '../../conversion/link-converter.ts';

interface ConvertLinksInFolderCommandHandlerConstructorParams {
  readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  readonly linkConverter: LinkConverter;
}

export class ConvertLinksInFolderCommandHandler extends FolderCommandHandler {
  private readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksInFolderCommandHandlerConstructorParams) {
    super({
      fileMenuItemName: 'Convert links in folder',
      fileMenuSubmenuIcon: 'link-2',
      filesMenuItemName: 'Convert links in folders',
      icon: 'link',
      id: 'convert-links-in-current-folder',
      name: 'Convert links in current folder',
      shouldAddCommandToSubmenu: true
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
          shouldResolveUnresolvedLinks: true
        });
      },
      summary: `Convert links in ${folder.path}`
    });
  }

  protected override shouldAddToFolderMenu(): boolean {
    return true;
  }
}
