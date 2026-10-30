import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { App } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { EmbedDemoter } from '../../conversion/embed-demoter.ts';

interface DemoteEmbedsInEntireVaultCommandHandlerConstructorParams {
  readonly app: App;
  readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  readonly embedDemoter: EmbedDemoter;
}

export class DemoteEmbedsInEntireVaultCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  private readonly embedDemoter: EmbedDemoter;

  public constructor(params: DemoteEmbedsInEntireVaultCommandHandlerConstructorParams) {
    super({
      icon: 'link',
      id: 'demote-embeds-to-links-in-entire-vault',
      name: 'Demote embeds to links in entire vault'
    });

    this.bulkOperationCommitComponent = params.bulkOperationCommitComponent;
    this.app = params.app;
    this.embedDemoter = params.embedDemoter;
  }

  protected override async execute(): Promise<void> {
    await this.bulkOperationCommitComponent.runBulkOperation({
      operation: async () => {
        await this.embedDemoter.demoteEmbedsInFolder({
          folder: this.app.vault.getRoot()
        });
      },
      summary: 'Demote embeds to links in entire vault'
    });
  }
}
