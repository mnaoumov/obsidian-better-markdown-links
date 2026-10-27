import type { FileCommandHandlerShouldAddToFileMenuParams } from '@mnaoumov/obsidian-lib/command-handlers/file-command-handler';
import type { TFile } from 'obsidian';

import { FileCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/file-command-handler';
import { isMarkdownFile } from '@mnaoumov/obsidian-lib/file-system';

import type { EmbedDemoter } from '../../conversion/embed-demoter.ts';

interface DemoteEmbedsInFileCommandHandlerConstructorParams {
  readonly embedDemoter: EmbedDemoter;
}

export class DemoteEmbedsInFileCommandHandler extends FileCommandHandler {
  private readonly embedDemoter: EmbedDemoter;

  public constructor(params: DemoteEmbedsInFileCommandHandlerConstructorParams) {
    super({
      fileMenuItemName: 'Demote embeds to links in file',
      fileMenuSubmenuIcon: 'link-2',
      filesMenuItemName: 'Demote embeds to links in files',
      icon: 'link',
      id: 'demote-embeds-to-links-in-current-file',
      name: 'Demote embeds to links in current file',
      shouldAddCommandToSubmenu: true
    });

    this.embedDemoter = params.embedDemoter;
  }

  protected override canExecuteFile(file: TFile): boolean {
    return isMarkdownFile(file);
  }

  protected override async executeFile(file: TFile): Promise<void> {
    await this.embedDemoter.demoteEmbedsInFile({
      file,
      shouldPromptForExcludedFile: true
    });
  }

  // eslint-disable-next-line typescript-dev-toolkit/params-options-name-match -- Override must keep the base param type.
  protected override shouldAddToFileMenu(params: FileCommandHandlerShouldAddToFileMenuParams): boolean {
    return isMarkdownFile(params.file);
  }
}
