import type {
  App,
  TFile
} from 'obsidian';

import { FileCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/file-command-handler';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

import type { Plugin } from '../plugin.ts';

import { convertLinksInFile } from '../link-converter.ts';

export class ConvertLinksInFileCommandHandler extends FileCommandHandler {
  private readonly app: App;

  public constructor(private readonly plugin: Plugin) {
    super({
      fileMenuItemName: 'Convert links in file',
      fileMenuSubmenuIcon: 'link-2',
      filesMenuItemName: 'Convert links in files',
      icon: 'link',
      id: 'convert-links-in-current-file',
      name: 'Convert links in current file',
      shouldAddCommandToSubmenu: true
    });
    this.app = this.plugin.app;
  }

  protected override canExecuteFile(file: TFile): boolean {
    if (!super.canExecute()) {
      return false;
    }
    return isMarkdownFile(this.app, file);
  }

  protected override async executeFile(file: TFile): Promise<void> {
    await super.execute();
    await convertLinksInFile(this.plugin, file, this.plugin.abortSignal, true);
  }

  protected override shouldAddToFileMenu(file: TFile): boolean {
    return isMarkdownFile(this.app, file);
  }
}
