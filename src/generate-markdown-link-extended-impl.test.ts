import type {
  App as AppOriginal,
  FileManager,
  TFile as TFileOriginal
} from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  GenerateMarkdownLinkExtendedOptions,
  GenerateMarkdownLinkExtendedWrapper
} from './generate-markdown-link-extended.d.ts';

type GenerateMarkdownLinkNativeFn = FileManager['generateMarkdownLink'];

vi.mock('obsidian-dev-utils/obsidian/link', () => ({
  generateMarkdownLink: vi.fn().mockReturnValue('[generated](link.md)')
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { generateMarkdownLink } from 'obsidian-dev-utils/obsidian/link';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { GenerateMarkdownLinkPatchComponent } from './generate-markdown-link-extended-impl.ts';

type PatchedGenerateMarkdownLink = GenerateMarkdownLinkExtendedWrapper & GenerateMarkdownLinkNativeFn;

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
    expect(typeof patched.extended).toBe('function');
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

  describe('extended', () => {
    it('should generate a link forwarding the extended options', () => {
      const patched = loadPatched(app);
      const options: GenerateMarkdownLinkExtendedOptions = {
        isEmbed: true,
        sourcePathOrFile: 'source.md',
        targetPathOrFile: file
      };

      const result = patched.extended(options);

      expect(result).toBe('[generated](link.md)');
      expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledExactlyOnceWith({
        app,
        isEmbed: true,
        sourcePathOrFile: 'source.md',
        targetPathOrFile: file
      });
    });
  });
});
