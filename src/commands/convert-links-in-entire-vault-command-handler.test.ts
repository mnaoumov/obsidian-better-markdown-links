import type { TFolder } from 'obsidian';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { Plugin } from '../plugin.ts';

import { convertLinksInFolder } from '../link-converter.ts';
import { ConvertLinksInEntireVaultCommandHandler } from './convert-links-in-entire-vault-command-handler.ts';

vi.mock('../link-converter.ts', () => ({
  convertLinksInFolder: vi.fn().mockResolvedValue(undefined)
}));

function createMockPlugin(): Plugin {
  const root = strictProxy<TFolder>({ path: '/' });
  return strictProxy<Plugin>({
    abortSignal: new AbortController().signal,
    app: {
      vault: {
        getRoot: vi.fn().mockReturnValue(root)
      }
    }
  });
}

describe('ConvertLinksInEntireVaultCommandHandler', () => {
  it('should create handler with correct id and name', () => {
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInEntireVaultCommandHandler(plugin);

    expect(handler.id).toBe('convert-links-in-entire-vault');
    expect(handler.name).toBe('Convert links in entire vault');
  });

  it('should call convertLinksInFolder with vault root on execute', async () => {
    const plugin = createMockPlugin();
    const handler = new ConvertLinksInEntireVaultCommandHandler(plugin);

    await handler['execute']();

    expect(vi.mocked(convertLinksInFolder)).toHaveBeenCalledOnce();
  });
});
