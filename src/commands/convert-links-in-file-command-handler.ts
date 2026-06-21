import type {
  App,
  TFile
} from 'obsidian';

import { FileCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/file-command-handler';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

import type { LinkConverter } from '../link-converter.ts';

interface ConvertLinksInFileCommandHandlerConstructorParams {
  readonly app: App;
  readonly linkConverter: LinkConverter;
}

export class ConvertLinksInFileCommandHandler extends FileCommandHandler {
  private readonly app: App;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksInFileCommandHandlerConstructorParams) {
    super({
      fileMenuItemName: 'Convert links in file',
      fileMenuSubmenuIcon: 'link-2',
      filesMenuItemName: 'Convert links in files',
      icon: 'link',
      id: 'convert-links-in-current-file',
      name: 'Convert links in current file',
      shouldAddCommandToSubmenu: true
    });

    this.app = params.app;
    this.linkConverter = params.linkConverter;
  }

  protected override canExecuteFile(file: TFile): boolean {
    return isMarkdownFile(this.app, file);
  }

  protected override async executeFile(file: TFile): Promise<void> {
    await this.linkConverter.convertLinksInFile({
      file,
      shouldPromptForExcludedFile: true
    });
  }

  protected override shouldAddToFileMenu(file: TFile): boolean {
    return isMarkdownFile(this.app, file);
  }
}
