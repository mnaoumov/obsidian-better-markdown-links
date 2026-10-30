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

import type { EmbedDemoter } from '../../conversion/embed-demoter.ts';

import { DemoteEmbedsInEntireVaultCommandHandler } from './demote-embeds-in-entire-vault-command-handler.ts';

describe('DemoteEmbedsInEntireVaultCommandHandler', () => {
  let app: AppOriginal;
  let demoteEmbedsInFolder: ReturnType<typeof vi.fn<EmbedDemoter['demoteEmbedsInFolder']>>;
  let handler: DemoteEmbedsInEntireVaultCommandHandler;
  let runBulkOperation: ReturnType<typeof vi.fn<BulkOperationCommitComponent['runBulkOperation']>>;

  beforeEach(() => {
    app = App.createConfigured__().asOriginalType__();
    demoteEmbedsInFolder = vi.fn<EmbedDemoter['demoteEmbedsInFolder']>().mockResolvedValue(undefined);
    const embedDemoter = strictProxy<EmbedDemoter>({ demoteEmbedsInFolder });
    runBulkOperation = vi.fn<BulkOperationCommitComponent['runBulkOperation']>(async (params) => await params.operation());
    const bulkOperationCommitComponent = strictProxy<BulkOperationCommitComponent>({ runBulkOperation: castTo(runBulkOperation) });
    handler = new DemoteEmbedsInEntireVaultCommandHandler({ app, bulkOperationCommitComponent, embedDemoter });
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(DemoteEmbedsInEntireVaultCommandHandler);
  });

  it('should demote embeds in the vault root folder on execute', async () => {
    const root = app.vault.getRoot();
    handler.buildCommand().checkCallback?.(false);

    await vi.waitFor(() => {
      expect(demoteEmbedsInFolder).toHaveBeenCalledExactlyOnceWith({ folder: root });
      expect(runBulkOperation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ summary: 'Demote embeds to links in entire vault' }));
    });
  });
});
