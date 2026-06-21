import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/folder-command-handler';

import { LinkConverter } from '../link-converter.ts';

interface ConvertLinksInFolderCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

export class ConvertLinksInFolderCommandHandler extends FolderCommandHandler {
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

    this.linkConverter = params.linkConverter;
  }

  protected override canExecuteFolder(): boolean {
    return true;
  }

  protected override async executeFolder(folder: TFolder): Promise<void> {
    await this.linkConverter.convertLinksInFolder({
      folder
    });
  }

  protected override shouldAddToFolderMenu(): boolean {
    return true;
  }
}
