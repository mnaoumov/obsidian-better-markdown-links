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

import type { LinkConverter } from '../link-converter.ts';

import { ConvertLinksToMarkdownInEntireVaultCommandHandler } from './convert-links-to-markdown-in-entire-vault-command-handler.ts';

describe('ConvertLinksToMarkdownInEntireVaultCommandHandler', () => {
  let app: AppOriginal;
  let convertLinksInFolder: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFolder']>>;
  let handler: ConvertLinksToMarkdownInEntireVaultCommandHandler;

  beforeEach(() => {
    app = App.createConfigured__().asOriginalType__();
    convertLinksInFolder = vi.fn<LinkConverter['convertLinksInFolder']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFolder });
    handler = new ConvertLinksToMarkdownInEntireVaultCommandHandler({ app, linkConverter });
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
    });
  });
});
