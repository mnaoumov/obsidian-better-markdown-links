import type { BulkOperationCommitComponent } from '@mnaoumov/obsidian-lib/components/bulk-operation-commit-component';
import type { App as AppOriginal } from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { LinkConverter } from '../../conversion/link-converter.ts';

import { ConvertLinksToMarkdownInEntireVaultCommandHandler } from './convert-links-to-markdown-in-entire-vault-command-handler.ts';

describe('ConvertLinksToMarkdownInEntireVaultCommandHandler', () => {
  let app: AppOriginal;
  let convertLinksInFolder: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFolder']>>;
  let handler: ConvertLinksToMarkdownInEntireVaultCommandHandler;
  let runBulkOperation: ReturnType<typeof vi.fn<BulkOperationCommitComponent['runBulkOperation']>>;

  beforeEach(() => {
    app = App.createConfigured__().asOriginalType__();
    convertLinksInFolder = vi.fn<LinkConverter['convertLinksInFolder']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFolder });
    runBulkOperation = vi.fn<BulkOperationCommitComponent['runBulkOperation']>(async (params) => await params.operation());
    const bulkOperationCommitComponent = strictProxy<BulkOperationCommitComponent>({ runBulkOperation: castTo(runBulkOperation) });
    handler = new ConvertLinksToMarkdownInEntireVaultCommandHandler({ app, bulkOperationCommitComponent, linkConverter });
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinksToMarkdownInEntireVaultCommandHandler);
  });

  it('should force the markdown style over the vault root folder on execute', async () => {
    const root = app.vault.getRoot();
    handler.buildCommand().checkCallback?.(false);

    await vi.waitFor(() => {
      expect(convertLinksInFolder).toHaveBeenCalledExactlyOnceWith({
        folder: root,
        shouldForceMarkdownLinkStyle: true,
        shouldResolveUnresolvedLinks: true
      });
      expect(runBulkOperation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ summary: 'Convert links to Markdown in entire vault' }));
    });
  });
});
