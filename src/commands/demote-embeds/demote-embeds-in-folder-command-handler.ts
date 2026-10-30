import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/folder-command-handler';

import type { EmbedDemoter } from '../../conversion/embed-demoter.ts';

interface DemoteEmbedsInFolderCommandHandlerConstructorParams {
  readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  readonly embedDemoter: EmbedDemoter;
}

export class DemoteEmbedsInFolderCommandHandler extends FolderCommandHandler {
  private readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  private readonly embedDemoter: EmbedDemoter;

  public constructor(params: DemoteEmbedsInFolderCommandHandlerConstructorParams) {
    super({
      fileMenuItemName: 'Demote embeds to links in folder',
      fileMenuSubmenuIcon: 'link-2',
      filesMenuItemName: 'Demote embeds to links in folders',
      icon: 'link',
      id: 'demote-embeds-to-links-in-current-folder',
      name: 'Demote embeds to links in current folder',
      shouldAddCommandToSubmenu: true
    });

    this.bulkOperationCommitComponent = params.bulkOperationCommitComponent;
    this.embedDemoter = params.embedDemoter;
  }

  protected override canExecuteFolder(): boolean {
    return true;
  }

  protected override async executeFolder(folder: TFolder): Promise<void> {
    await this.bulkOperationCommitComponent.runBulkOperation({
      operation: async () => {
        await this.embedDemoter.demoteEmbedsInFolder({
          folder
        });
      },
      summary: `Demote embeds to links in ${folder.path}`
    });
  }

  protected override shouldAddToFolderMenu(): boolean {
    return true;
  }
}
