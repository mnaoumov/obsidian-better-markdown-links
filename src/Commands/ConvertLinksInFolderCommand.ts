import type { TFolder } from 'obsidian';

import {
  FolderCommandBase,
  FolderCommandInvocationBase
} from 'obsidian-dev-utils/obsidian/Commands/FolderCommandBase';

import type { Plugin } from '../Plugin.ts';

import { convertLinksInFolder } from '../LinkConverter.ts';

class ConvertLinksInFolderCommandInvocation extends FolderCommandInvocationBase<Plugin> {
  protected override canExecute(): boolean {
    if (!super.canExecute()) {
      return false;
    }
    return true;
  }

  protected override async execute(): Promise<void> {
    await super.execute();
    await convertLinksInFolder(this.plugin, this.folder, this.plugin.abortSignal);
  }
}

export class ConvertLinksInFolderCommand extends FolderCommandBase<Plugin> {
  public constructor(plugin: Plugin) {
    super({
      fileMenuItemName: 'Convert links in folder',
      fileMenuSubmenuIcon: 'link-2',
      filesMenuItemName: 'Convert links in folders',
      icon: 'link',
      id: 'convert-links-in-current-folder',
      name: 'Convert links in current folder',
      plugin,
      shouldAddCommandToSubmenu: true
    });
  }

  protected override createCommandInvocationForFolder(folder: null | TFolder): FolderCommandInvocationBase<Plugin> {
    return new ConvertLinksInFolderCommandInvocation(this.plugin, folder);
  }

  protected override shouldAddToFolderMenu(): boolean {
    return true;
  }
}
