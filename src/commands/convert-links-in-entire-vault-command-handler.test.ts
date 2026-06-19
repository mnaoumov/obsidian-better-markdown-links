import type {
  App,
  TFolder
} from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { LinkConverter } from '../link-converter.ts';

vi.mock('obsidian-dev-utils/obsidian/command-handlers/global-command-handler', () => ({
  GlobalCommandHandler: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { ConvertLinksInEntireVaultCommandHandler } from './convert-links-in-entire-vault-command-handler.ts';

interface CommandHandlerPrivate {
  execute(): Promise<void>;
}

function asPrivate(handler: ConvertLinksInEntireVaultCommandHandler): CommandHandlerPrivate {
  return castTo<CommandHandlerPrivate>(handler);
}

describe('ConvertLinksInEntireVaultCommandHandler', () => {
  let convertLinksInFolder: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFolder']>>;
  let root: TFolder;
  let handler: ConvertLinksInEntireVaultCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    convertLinksInFolder = vi.fn<LinkConverter['convertLinksInFolder']>().mockResolvedValue(undefined);
    root = strictProxy<TFolder>({ path: '/' });
    const app = strictProxy<App>({
      vault: {
        getRoot: vi.fn().mockReturnValue(root)
      }
    });
    const linkConverter = strictProxy<LinkConverter>({ convertLinksInFolder });
    handler = new ConvertLinksInEntireVaultCommandHandler({ app, linkConverter });
  });

  it('should create an instance', () => {
    expect(handler).toBeInstanceOf(ConvertLinksInEntireVaultCommandHandler);
  });

  it('should convert links in the vault root folder on execute', async () => {
    await asPrivate(handler).execute();

    expect(convertLinksInFolder).toHaveBeenCalledExactlyOnceWith({ folder: root });
  });
});
