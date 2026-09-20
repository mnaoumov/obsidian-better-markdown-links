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

import { ConvertLinkPathsToRelativeInEntireVaultCommandHandler } from './convert-link-paths-to-relative-in-entire-vault-command-handler.ts';

describe('ConvertLinkPathsToRelativeInEntireVaultCommandHandler', () => {
  let app: AppOriginal;
  let convertLinksInFolder: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFolder']>>;
  let handler: ConvertLinkPathsToRelativeInEntireVaultCommandHandler;

  beforeEach(() => {
    app = App.createConfigured__().asOriginalType__();
    convertLinksInFolder = vi.fn<LinkConverter['convertLinksInFolder']>().mockResolvedValue(undefined);
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFolder });
    handler = new ConvertLinkPathsToRelativeInEntireVaultCommandHandler({ app, linkConverter });
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinkPathsToRelativeInEntireVaultCommandHandler);
  });

  it('should force the relative path style over the vault root folder on execute', async () => {
    const root = app.vault.getRoot();
    handler.buildCommand().checkCallback?.(false);

    await vi.waitFor(() => {
      expect(convertLinksInFolder).toHaveBeenCalledExactlyOnceWith({
        folder: root,
        shouldForceRelativeLinkPathStyle: true,
        shouldResolveUnresolvedLinks: true
      });
    });
  });
});
