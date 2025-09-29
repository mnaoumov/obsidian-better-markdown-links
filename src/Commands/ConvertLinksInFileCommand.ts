import type { TFile } from 'obsidian';

import {
  FileCommandBase,
  FileCommandInvocationBase
} from 'obsidian-dev-utils/obsidian/Commands/FileCommandBase';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/FileSystem';

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
  protected override fileMenuItemName = 'Convert links in file';
  protected override filesMenuItemName = 'Convert links in files';

  public constructor(plugin: Plugin) {
    super({
      icon: 'link',
      id: 'convert-links-in-current-file',
      name: 'Convert links in current file',
      plugin
    });
  }

  protected override createCommandInvocation(): FileCommandInvocationBase<Plugin> {
    return new ConvertLinksInFileCommandInvocation(this.plugin);
  }

  protected override shouldAddToFileMenu(file: TFile): boolean {
    return isMarkdownFile(this.app, file);
  }
}
