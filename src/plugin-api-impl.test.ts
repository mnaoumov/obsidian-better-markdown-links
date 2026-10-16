import type {
  App as AppOriginal,
  TFile as TFileOriginal
} from 'obsidian';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenerateMarkdownLinkExtendedOptions } from '../api.d.ts';

vi.mock('@mnaoumov/obsidian-lib/link', async (importOriginal) => ({
  ...await importOriginal<typeof import('@mnaoumov/obsidian-lib/link')>(),
  generateMarkdownLink: vi.fn().mockReturnValue('[generated](link.md)')
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { generateMarkdownLink } from '@mnaoumov/obsidian-lib/link';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginApiImpl } from './plugin-api-impl.ts';

describe('PluginApiImpl', () => {
  let app: AppOriginal;
  let file: TFileOriginal;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateMarkdownLink).mockReturnValue('[generated](link.md)');
    app = App.createConfigured__().asOriginalType__();
    file = strictProxy<TFileOriginal>({ path: 'target.md' });
  });

  it('should generate a link forwarding the extended options', () => {
    const api = new PluginApiImpl({ app });
    const options: GenerateMarkdownLinkExtendedOptions = {
      isEmbed: true,
      sourcePathOrFile: 'source.md',
      targetPathOrFile: file
    };

    const result = api.generateMarkdownLinkExtended(options);

    expect(result).toBe('[generated](link.md)');
    expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledExactlyOnceWith({
      app,
      isEmbed: true,
      sourcePathOrFile: 'source.md',
      targetPathOrFile: file
    });
  });
});
