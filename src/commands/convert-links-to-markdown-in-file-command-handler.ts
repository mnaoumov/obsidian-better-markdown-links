import type { TFile } from 'obsidian';

import { FileCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/file-command-handler';
import { isMarkdownFile } from 'obsidian-dev-utils/obsidian/file-system';

import type { LinkConverter } from '../link-converter.ts';

interface ConvertLinksToMarkdownInFileCommandHandlerConstructorParams {
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the current file, forcing the markdown style for this one run.
 *
 * Palette-only, deliberately: `Convert links in file` already sits in the file menu, and a second, nearly
 * identically named row beside it would cost more than it explains.
 */
export class ConvertLinksToMarkdownInFileCommandHandler extends FileCommandHandler {
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksToMarkdownInFileCommandHandlerConstructorParams) {
    super({
      icon: 'replace',
      id: 'convert-links-to-markdown-in-current-file',
      name: 'Convert links to Markdown in current file'
    });

    this.linkConverter = params.linkConverter;
  }

  protected override canExecuteFile(file: TFile): boolean {
    return isMarkdownFile(file);
  }

  protected override async executeFile(file: TFile): Promise<void> {
    await this.linkConverter.convertLinksInFile({
      file,
      shouldForceMarkdownLinkStyle: true,
      shouldPromptForExcludedFile: true,
      shouldResolveUnresolvedLinks: true
    });
  }
}
