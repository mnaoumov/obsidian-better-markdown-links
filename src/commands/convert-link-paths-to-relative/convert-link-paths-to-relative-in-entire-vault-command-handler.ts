import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { App } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { LinkConverter } from '../../conversion/link-converter.ts';

interface ConvertLinkPathsToRelativeInEntireVaultCommandHandlerConstructorParams {
  readonly app: App;
  readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  readonly linkConverter: LinkConverter;
}

/**
 * Converts links in the entire vault, forcing the relative path style for this one run. The direct
 * replacement for `Convert all link paths to relative` from `Consistent Attachments and Links`.
 */
export class ConvertLinkPathsToRelativeInEntireVaultCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly bulkOperationCommitComponent: BulkOperationCommitComponent;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinkPathsToRelativeInEntireVaultCommandHandlerConstructorParams) {
    super({
      icon: 'folder-tree',
      id: 'convert-link-paths-to-relative-in-entire-vault',
      name: 'Convert link paths to relative in entire vault'
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
          shouldForceRelativeLinkPathStyle: true,
          shouldResolveUnresolvedLinks: true
        });
      },
      summary: 'Convert link paths to relative in entire vault'
    });
  }
}
