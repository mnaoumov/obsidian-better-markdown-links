import type {
  App as AppOriginal,
  FileManager,
  TFile as TFileOriginal
} from 'obsidian';

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

type GenerateMarkdownLinkNativeFunction = FileManager['generateMarkdownLink'];

vi.mock('@mnaoumov/obsidian-lib/link', async (importOriginal) => ({
  ...await importOriginal<typeof import('@mnaoumov/obsidian-lib/link')>(),
  generateMarkdownLink: vi.fn().mockReturnValue('[generated](link.md)')
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { generateMarkdownLink } from '@mnaoumov/obsidian-lib/link';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { GenerateMarkdownLinkPatchComponent } from './generate-markdown-link-extended-impl.ts';

type PatchedGenerateMarkdownLink = GenerateMarkdownLinkNativeFunction & Partial<Record<'extended', unknown>>;

function loadPatched(app: AppOriginal): PatchedGenerateMarkdownLink {
  const component = new GenerateMarkdownLinkPatchComponent({
    app,
    fileManager: app.fileManager
  });
  component.load();
  return castTo<PatchedGenerateMarkdownLink>(app.fileManager.generateMarkdownLink);
}

describe('GenerateMarkdownLinkPatchComponent', () => {
  let app: AppOriginal;
  let file: TFileOriginal;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateMarkdownLink).mockReturnValue('[generated](link.md)');
    app = App.createConfigured__().asOriginalType__();
    file = strictProxy<TFileOriginal>({ path: 'target.md' });
  });

  it('should register a patch on the file manager generateMarkdownLink', () => {
    const original = app.fileManager.generateMarkdownLink;
    const component = new GenerateMarkdownLinkPatchComponent({
      app,
      fileManager: app.fileManager
    });
    component.load();

    expect(app.fileManager.generateMarkdownLink).not.toBe(original);
    const patched = castTo<PatchedGenerateMarkdownLink>(app.fileManager.generateMarkdownLink);
    // The plugin offers its extended generator through its plugin API, never as a member grafted onto Obsidian's call.
    expect(patched.extended).toBeUndefined();
  });

  describe('native', () => {
    it('should generate a link forwarding all native arguments', () => {
      const patched = loadPatched(app);

      const result = patched(file, 'source.md', '#heading', 'My Alias');

      expect(result).toBe('[generated](link.md)');
      expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledExactlyOnceWith({
        alias: 'My Alias',
        app,
        sourcePathOrFile: 'source.md',
        subpath: '#heading',
        targetPathOrFile: file
      });
    });

    it('should omit undefined optional arguments', () => {
      const patched = loadPatched(app);

      patched(file, 'source.md');

      expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledExactlyOnceWith({
        app,
        sourcePathOrFile: 'source.md',
        targetPathOrFile: file
      });
    });
  });
});
