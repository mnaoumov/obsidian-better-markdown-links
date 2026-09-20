import type { TFolder } from 'obsidian';

import { FolderCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/folder-command-handler';

import type { LinkConverter } from '../link-converter.ts';

interface ConvertLinkPathsToRelativeInFolderCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the current folder, forcing the relative path style for this one run.
 *
 * Palette-only, for the reason given on {@link ConvertLinkPathsToRelativeInFileCommandHandler}.
 */
export class ConvertLinkPathsToRelativeInFolderCommandHandler extends FolderCommandHandler {
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinkPathsToRelativeInFolderCommandHandlerConstructorParams) {
    super({
      icon: 'folder-tree',
      id: 'convert-link-paths-to-relative-in-current-folder',
      name: 'Convert link paths to relative in current folder'
    });

    this.linkConverter = params.linkConverter;
  }

  protected override canExecuteFolder(): boolean {
    return true;
  }

  protected override async executeFolder(folder: TFolder): Promise<void> {
    await this.linkConverter.convertLinksInFolder({
      folder,
      shouldForceRelativeLinkPathStyle: true,
      shouldResolveUnresolvedLinks: true
    });
  }
}
