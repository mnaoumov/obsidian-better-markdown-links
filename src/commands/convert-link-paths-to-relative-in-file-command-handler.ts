import type { TFile } from 'obsidian';

import { FileCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/file-command-handler';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

import type { LinkConverter } from '../link-converter.ts';

interface ConvertLinkPathsToRelativeInFileCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the current file, forcing the relative path style for this one run.
 *
 * Palette-only, deliberately: `Convert links in file` already sits in the file menu, and a second, nearly
 * identically named row beside it would cost more than it explains.
 */
export class ConvertLinkPathsToRelativeInFileCommandHandler extends FileCommandHandler {
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinkPathsToRelativeInFileCommandHandlerConstructorParams) {
    super({
      icon: 'folder-tree',
      id: 'convert-link-paths-to-relative-in-current-file',
      name: 'Convert link paths to relative in current file'
    });

    this.linkConverter = params.linkConverter;
  }

  protected override canExecuteFile(file: TFile): boolean {
    return isMarkdownFile(file);
  }

  protected override async executeFile(file: TFile): Promise<void> {
    await this.linkConverter.convertLinksInFile({
      file,
      shouldForceRelativeLinkPathStyle: true,
      shouldPromptForExcludedFile: true,
      shouldResolveUnresolvedLinks: true
    });
  }
}
