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
  protected override fileMenuItemName = 'Convert links in folder';
  protected override filesMenuItemName = 'Convert links in folders';

  public constructor(plugin: Plugin) {
    super({
      icon: 'link',
      id: 'convert-links-in-current-folder',
      name: 'Convert links in current folder',
      plugin
    });
  }

  protected override createCommandInvocation(): FolderCommandInvocationBase<Plugin> {
    return new ConvertLinksInFolderCommandInvocation(this.plugin);
  }

  protected override shouldAddToFolderMenu(): boolean {
    return true;
  }
}
