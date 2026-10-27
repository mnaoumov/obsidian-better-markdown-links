import type { FileCommandHandlerShouldAddToFileMenuParams } from '@mnaoumov/obsidian-lib/command-handlers/file-command-handler';
import type { TFile } from 'obsidian';

import { FileCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/file-command-handler';
import { isMarkdownFile } from '@mnaoumov/obsidian-lib/file-system';

import type { LinkConverter } from '../../conversion/link-converter.ts';

interface ConvertLinksInFileCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

export class ConvertLinksInFileCommandHandler extends FileCommandHandler {
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

    this.linkConverter = params.linkConverter;
  }

  protected override canExecuteFile(file: TFile): boolean {
    return isMarkdownFile(file);
  }

  protected override async executeFile(file: TFile): Promise<void> {
    await this.linkConverter.convertLinksInFile({
      file,
      shouldPromptForExcludedFile: true,
      shouldResolveUnresolvedLinks: true
    });
  }

  // eslint-disable-next-line typescript-dev-toolkit/params-options-name-match -- Override must keep the base param type.
  protected override shouldAddToFileMenu(params: FileCommandHandlerShouldAddToFileMenuParams): boolean {
    return isMarkdownFile(params.file);
  }
}
