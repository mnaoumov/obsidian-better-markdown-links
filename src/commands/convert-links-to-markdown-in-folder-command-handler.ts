import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/folder-command-handler';

import type { LinkConverter } from '../link-converter.ts';

interface ConvertLinksToMarkdownInFolderCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the current folder, forcing the markdown style for this one run.
 *
 * Palette-only, for the reason given on {@link ConvertLinksToMarkdownInFileCommandHandler}.
 */
export class ConvertLinksToMarkdownInFolderCommandHandler extends FolderCommandHandler {
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksToMarkdownInFolderCommandHandlerConstructorParams) {
    super({
      icon: 'replace',
      id: 'convert-links-to-markdown-in-current-folder',
      name: 'Convert links to Markdown in current folder'
    });

    this.linkConverter = params.linkConverter;
  }

  protected override canExecuteFolder(): boolean {
    return true;
  }

  protected override async executeFolder(folder: TFolder): Promise<void> {
    await this.linkConverter.convertLinksInFolder({
      folder,
      shouldForceMarkdownLinkStyle: true,
      shouldResolveUnresolvedLinks: true
    });
  }
}
