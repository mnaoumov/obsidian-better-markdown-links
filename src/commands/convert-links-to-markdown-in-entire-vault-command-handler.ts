import type { App } from 'obsidian';

import { GlobalCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/global-command-handler';

import type { LinkConverter } from '../link-converter.ts';

interface ConvertLinksToMarkdownInEntireVaultCommandHandlerConstructorParams {
  readonly app: App;
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the entire vault, forcing the markdown style for this one run. The direct replacement for
 * `Replace all wikilinks with markdown links` from Consistent Attachments and Links.
 */
export class ConvertLinksToMarkdownInEntireVaultCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksToMarkdownInEntireVaultCommandHandlerConstructorParams) {
    super({
      icon: 'replace',
      id: 'convert-links-to-markdown-in-entire-vault',
      name: 'Convert links to Markdown in entire vault'
    });

    this.app = params.app;
    this.linkConverter = params.linkConverter;
  }

  protected override async execute(): Promise<void> {
    await this.linkConverter.convertLinksInFolder({
      folder: this.app.vault.getRoot(),
      shouldForceMarkdownLinkStyle: true,
      shouldResolveUnresolvedLinks: true
    });
  }
}
