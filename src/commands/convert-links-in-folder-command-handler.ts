import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/folder-command-handler';

import type { Plugin } from '../plugin.ts';

import { convertLinksInFolder } from '../link-converter.ts';

export class ConvertLinksInFolderCommandHandler extends FolderCommandHandler {
  public constructor(private readonly plugin: Plugin) {
    super({
      fileMenuItemName: 'Convert links in folder',
      fileMenuSubmenuIcon: 'link-2',
      filesMenuItemName: 'Convert links in folders',
      icon: 'link',
      id: 'convert-links-in-current-folder',
      name: 'Convert links in current folder',
      shouldAddCommandToSubmenu: true
    });
  }

  protected override canExecuteFolder(): boolean {
    return true;
  }

  protected override async executeFolder(folder: TFolder): Promise<void> {
    await super.execute();
    await convertLinksInFolder(this.plugin, folder, this.plugin.abortSignal);
  }

  protected override shouldAddToFolderMenu(): boolean {
    return true;
  }
}
