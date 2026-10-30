import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { App } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { LinkConverter } from '../../conversion/link-converter.ts';

interface ConvertLinksInEntireVaultCommandHandlerConstructorParams {
  readonly app: App;
  readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  readonly linkConverter: LinkConverter;
}

export class ConvertLinksInEntireVaultCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksInEntireVaultCommandHandlerConstructorParams) {
    super({
      icon: 'link',
      id: 'convert-links-in-entire-vault',
      name: 'Convert links in entire vault'
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
          shouldResolveUnresolvedLinks: true
        });
      },
      summary: 'Convert links in entire vault'
    });
  }
}
