import type {
  App,
  FileManager,
  TFile
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

import type { GenerateMarkdownLinkNativeFn } from './generate-markdown-link-extended-impl.ts';
import type {
  GenerateMarkdownLinkExtendedOptions,
  GenerateMarkdownLinkExtendedWrapper
} from './generate-markdown-link-extended.d.ts';

const { mockRegisterPatch } = vi.hoisted(() => ({
  mockRegisterPatch: vi.fn<(obj: object, factories: PatchFactories) => void>()
}));

vi.mock('obsidian-dev-utils/obsidian/components/monkey-around-component', () => ({
  MonkeyAroundComponent: class {
    public registerPatch = mockRegisterPatch;
  }
}));

vi.mock('obsidian-dev-utils/obsidian/link', () => ({
  generateMarkdownLink: vi.fn().mockReturnValue('[generated](link.md)')
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { generateMarkdownLink } from 'obsidian-dev-utils/obsidian/link';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { GenerateMarkdownLinkPatchComponent } from './generate-markdown-link-extended-impl.ts';

type PatchedGenerateMarkdownLink = GenerateMarkdownLinkExtendedWrapper & GenerateMarkdownLinkNativeFn;

interface PatchFactories {
  readonly generateMarkdownLink: WrapperFactory;
}

type WrapperFactory = (next: GenerateMarkdownLinkNativeFn) => PatchedGenerateMarkdownLink;

function buildPatched(app: App): PatchedGenerateMarkdownLink {
  const component = new GenerateMarkdownLinkPatchComponent(app);
  component.onload();

  const [patchedObj, factories] = mockRegisterPatch.mock.calls[0] ?? [];
  expect(patchedObj).toBe(app.fileManager);
  const factory = castTo<PatchFactories>(factories).generateMarkdownLink;
  return factory(castTo<GenerateMarkdownLinkNativeFn>(vi.fn()));
}

function createApp(): App {
  return strictProxy<App>({
    fileManager: strictProxy<FileManager>({})
  });
}

describe('GenerateMarkdownLinkPatchComponent', () => {
  let app: App;
  let file: TFile;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateMarkdownLink).mockReturnValue('[generated](link.md)');
    app = createApp();
    file = strictProxy<TFile>({ path: 'target.md' });
  });

  it('should register a patch on the file manager generateMarkdownLink', () => {
    const component = new GenerateMarkdownLinkPatchComponent(app);
    component.onload();

    expect(mockRegisterPatch).toHaveBeenCalledOnce();
    const [patchedObj, factories] = mockRegisterPatch.mock.calls[0] ?? [];
    expect(patchedObj).toBe(app.fileManager);
    expect(typeof factories?.generateMarkdownLink).toBe('function');
  });

  describe('native', () => {
    it('should generate a link forwarding all native arguments', () => {
      const patched = buildPatched(app);

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
      const patched = buildPatched(app);

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
      const patched = buildPatched(app);
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
