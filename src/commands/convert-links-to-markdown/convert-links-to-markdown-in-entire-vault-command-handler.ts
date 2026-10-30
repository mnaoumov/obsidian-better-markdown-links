import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { App } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { LinkConverter } from '../../conversion/link-converter.ts';

interface ConvertLinksToMarkdownInEntireVaultCommandHandlerConstructorParams {
  readonly app: App;
  readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the entire vault, forcing the markdown style for this one run. The direct replacement for
 * `Replace all wikilinks with markdown links` from `Consistent Attachments and Links`.
 */
export class ConvertLinksToMarkdownInEntireVaultCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksToMarkdownInEntireVaultCommandHandlerConstructorParams) {
    super({
      icon: 'replace',
      id: 'convert-links-to-markdown-in-entire-vault',
      name: 'Convert links to Markdown in entire vault'
    });

    this.bulkOperationCommitComponent = params.bulkOperationCommitComponent;
    this.app = params.app;
    this.linkConverter = params.linkConverter;
  }

  protected override async execute(): Promise<void> {
    await this.bulkOperationCommitComponent.runBulkOperation({
      operation: async () => {
        await this.linkConverter.convertLinksInFolder({
          folder: this.app.vault.getRoot(),
          shouldForceMarkdownLinkStyle: true,
          shouldResolveUnresolvedLinks: true
        });
      },
      summary: 'Convert links to Markdown in entire vault'
    });
  }
}
