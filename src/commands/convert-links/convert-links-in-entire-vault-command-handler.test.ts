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

import { ConvertLinksInEntireVaultCommandHandler } from './convert-links-in-entire-vault-command-handler.ts';

describe('ConvertLinksInEntireVaultCommandHandler', () => {
  let app: AppOriginal;
  let convertLinksInFolder: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFolder']>>;
  let handler: ConvertLinksInEntireVaultCommandHandler;
  let runBulkOperation: ReturnType<typeof vi.fn<BulkOperationCommitComponent['runBulkOperation']>>;

  beforeEach(() => {
    app = App.createConfigured__().asOriginalType__();
    convertLinksInFolder = vi.fn<LinkConverter['convertLinksInFolder']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFolder });
    runBulkOperation = vi.fn<BulkOperationCommitComponent['runBulkOperation']>(async (params) => await params.operation());
    const bulkOperationCommitComponent = strictProxy<BulkOperationCommitComponent>({ runBulkOperation: castTo(runBulkOperation) });
    handler = new ConvertLinksInEntireVaultCommandHandler({ app, bulkOperationCommitComponent, linkConverter });
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinksInEntireVaultCommandHandler);
  });

  it('should convert links in the vault root folder on execute', async () => {
    const root = app.vault.getRoot();
    handler.buildCommand().checkCallback?.(false);

    await vi.waitFor(() => {
      expect(convertLinksInFolder).toHaveBeenCalledExactlyOnceWith({ folder: root, shouldResolveUnresolvedLinks: true });
      expect(runBulkOperation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ summary: 'Convert links in entire vault' }));
    });
  });
});
