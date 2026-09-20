import type { App } from 'obsidian';

import { GlobalCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/global-command-handler';

import type { LinkConverter } from '../link-converter.ts';

interface ConvertLinkPathsToRelativeInEntireVaultCommandHandlerConstructorParams {
  readonly app: App;
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the entire vault, forcing the relative path style for this one run. The direct
 * replacement for `Convert all link paths to relative` from Consistent Attachments and Links.
 */
export class ConvertLinkPathsToRelativeInEntireVaultCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinkPathsToRelativeInEntireVaultCommandHandlerConstructorParams) {
    super({
      icon: 'folder-tree',
      id: 'convert-link-paths-to-relative-in-entire-vault',
      name: 'Convert link paths to relative in entire vault'
    });

    this.app = params.app;
    this.linkConverter = params.linkConverter;
  }

  protected override async execute(): Promise<void> {
    await this.linkConverter.convertLinksInFolder({
      folder: this.app.vault.getRoot(),
      shouldForceRelativeLinkPathStyle: true,
      shouldResolveUnresolvedLinks: true
    });
  }
}
