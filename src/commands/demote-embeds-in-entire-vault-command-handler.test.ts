import type { App as AppOriginal } from 'obsidian';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { EmbedDemoter } from '../embed-demoter.ts';

import { DemoteEmbedsInEntireVaultCommandHandler } from './demote-embeds-in-entire-vault-command-handler.ts';

describe('DemoteEmbedsInEntireVaultCommandHandler', () => {
  let app: AppOriginal;
  let demoteEmbedsInFolder: ReturnType<typeof vi.fn<EmbedDemoter['demoteEmbedsInFolder']>>;
  let handler: DemoteEmbedsInEntireVaultCommandHandler;

  beforeEach(() => {
    app = App.createConfigured__().asOriginalType__();
    demoteEmbedsInFolder = vi.fn<EmbedDemoter['demoteEmbedsInFolder']>().mockResolvedValue(undefined);
    const embedDemoter = strictProxy<EmbedDemoter>({ demoteEmbedsInFolder });
    handler = new DemoteEmbedsInEntireVaultCommandHandler({ app, embedDemoter });
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(DemoteEmbedsInEntireVaultCommandHandler);
  });

  it('should demote embeds in the vault root folder on execute', async () => {
    const root = app.vault.getRoot();
    handler.buildCommand().checkCallback?.(false);

    await vi.waitFor(() => {
      expect(demoteEmbedsInFolder).toHaveBeenCalledExactlyOnceWith({ folder: root });
    });
  });
});
