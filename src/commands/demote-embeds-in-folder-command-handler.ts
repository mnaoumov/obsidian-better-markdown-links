import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/folder-command-handler';

import type { EmbedDemoter } from '../embed-demoter.ts';

interface DemoteEmbedsInFolderCommandHandlerConstructorParams {
  readonly embedDemoter: EmbedDemoter;
}

export class DemoteEmbedsInFolderCommandHandler extends FolderCommandHandler {
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

    this.embedDemoter = params.embedDemoter;
  }

  protected override canExecuteFolder(): boolean {
    return true;
  }

  protected override async executeFolder(folder: TFolder): Promise<void> {
    await this.embedDemoter.demoteEmbedsInFolder({
      folder
    });
  }

  protected override shouldAddToFolderMenu(): boolean {
    return true;
  }
}
