import type { TFile } from 'obsidian';

import {
  FileCommandBase,
  FileCommandInvocationBase
} from 'obsidian-dev-utils/obsidian/commands/file-command-base';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

import type { Plugin } from '../Plugin.ts';

import { convertLinksInFile } from '../LinkConverter.ts';

class ConvertLinksInFileCommandInvocation extends FileCommandInvocationBase<Plugin> {
  protected override canExecute(): boolean {
    if (!super.canExecute()) {
      return false;
    }
    return isMarkdownFile(this.app, this.file);
  }

  protected override async execute(): Promise<void> {
    await super.execute();
    await convertLinksInFile(this.plugin, this.file, this.plugin.abortSignal, true);
  }
}

export class ConvertLinksInFileCommand extends FileCommandBase<Plugin> {
  public constructor(plugin: Plugin) {
    super({
      fileMenuItemName: 'Convert links in file',
      fileMenuSubmenuIcon: 'link-2',
      filesMenuItemName: 'Convert links in files',
      icon: 'link',
      id: 'convert-links-in-current-file',
      name: 'Convert links in current file',
      plugin,
      shouldAddCommandToSubmenu: true
    });
  }

  protected override createCommandInvocationForFile(file: null | TFile): FileCommandInvocationBase<Plugin> {
    return new ConvertLinksInFileCommandInvocation(this.plugin, file);
  }

  protected override shouldAddToFileMenu(file: TFile): boolean {
    return isMarkdownFile(this.app, file);
  }
}
