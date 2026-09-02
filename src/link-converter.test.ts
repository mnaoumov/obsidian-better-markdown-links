import type {
  App,
  TFile,
  TFolder
} from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { LinkStyle } from 'obsidian-dev-utils/obsidian/link';
import type { ResourceLockComponent } from 'obsidian-dev-utils/obsidian/resource-lock';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { PluginSettings } from './plugin-settings.ts';

vi.mock('obsidian-dev-utils/abort-controller', () => ({
  abortSignalAny: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/file-system', () => ({
  getMarkdownFiles: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/link', () => ({
  // `LinkStyle` is a real value import in the converter now, so the mock has to carry it.
  LinkStyle: {
    Markdown: 'Markdown',
    ObsidianSettingsDefault: 'ObsidianSettingsDefault',
    PreserveExisting: 'PreserveExisting',
    Wikilink: 'Wikilink'
  },
  updateFileUrlLinksInFile: vi.fn(),
  updateLinksInFile: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/loop', () => ({
  loop: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/modals/confirm', () => ({
  confirm: vi.fn()
}));

vi.mock('./unresolved-link-resolver.ts', () => ({
  resolveUnresolvedLinksInFile: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { getMarkdownFiles } from 'obsidian-dev-utils/obsidian/file-system';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  updateFileUrlLinksInFile,
  updateLinksInFile
} from 'obsidian-dev-utils/obsidian/link';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { loop } from 'obsidian-dev-utils/obsidian/loop';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { confirm } from 'obsidian-dev-utils/obsidian/modals/confirm';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { LinkConverter } from './link-converter.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { resolveUnresolvedLinksInFile } from './unresolved-link-resolver.ts';

const LINK_STYLE = castTo<LinkStyle>('ObsidianSettingsDefault');

interface CreateConverterOptions {
  readonly shouldCreateMissingNotes?: boolean;
  readonly shouldNormalizeFileLinks?: boolean;
  readonly shouldResolveLinksViaAliases?: boolean;
}

interface CreateConverterResult {
  readonly abortSignal: AbortSignal;
  readonly app: App;
  readonly converter: LinkConverter;
  readonly getActiveFile: ReturnType<typeof vi.fn>;
  readonly getLinkStyle: ReturnType<typeof vi.fn>;
  readonly isPathIgnored: ReturnType<typeof vi.fn>;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly resourceLockComponent: ResourceLockComponent;
}

function createConverter(options: CreateConverterOptions = {}): CreateConverterResult {
  const abortSignal = new AbortController().signal;
  const abortSignalComponent = strictProxy<AbortSignalComponent>({ abortSignal });
  const getActiveFile = vi.fn();
  const app = strictProxy<App>({
    workspace: {
      getActiveFile
    }
  });
  const isPathIgnored = vi.fn<(path: string) => boolean>().mockReturnValue(false);
  const getLinkStyle = vi.fn<() => LinkStyle>().mockReturnValue(LINK_STYLE);
  const settings = strictProxy<PluginSettings>({
    getLinkStyle,
    isPathIgnored,
    shouldCreateMissingNotes: options.shouldCreateMissingNotes ?? false,
    shouldNormalizeFileLinks: options.shouldNormalizeFileLinks ?? true,
    shouldResolveLinksViaAliases: options.shouldResolveLinksViaAliases ?? false,
    shouldUseAngleBrackets: true
  });
  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({ settings });
  const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});
  const resourceLockComponent = strictProxy<ResourceLockComponent>({});

  const converter = new LinkConverter({
    abortSignalComponent,
    app,
    pluginNoticeComponent,
    pluginSettingsComponent,
    resourceLockComponent
  });

  return {
    abortSignal,
    app,
    converter,
    getActiveFile,
    getLinkStyle,
    isPathIgnored,
    pluginNoticeComponent,
    resourceLockComponent
  };
}

function createFile(path: string): TFile {
  return strictProxy<TFile>({ path });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(abortSignalAny).mockImplementation((...signals) => signals[0] ?? new AbortController().signal);
  vi.mocked(updateLinksInFile).mockResolvedValue(undefined);
  vi.mocked(updateFileUrlLinksInFile).mockResolvedValue(undefined);
  vi.mocked(loop).mockResolvedValue(undefined);
  vi.mocked(getMarkdownFiles).mockReturnValue([]);
  vi.mocked(resolveUnresolvedLinksInFile).mockResolvedValue(undefined);
});

describe('LinkConverter', () => {
  describe('convertLinksInFile', () => {
    it('should throw when the combined abort signal is already aborted', async () => {
      const context = createConverter();
      const controller = new AbortController();
      controller.abort();
      vi.mocked(abortSignalAny).mockReturnValue(controller.signal);

      await expect(context.converter.convertLinksInFile({ file: createFile('note.md') })).rejects.toThrow();
      expect(vi.mocked(updateLinksInFile)).not.toHaveBeenCalled();
    });

    it('should update links for a non-ignored file', async () => {
      const context = createConverter();
      const file = createFile('note.md');

      await context.converter.convertLinksInFile({ file });

      expect(context.getLinkStyle).toHaveBeenCalledOnce();
      expect(vi.mocked(updateLinksInFile)).toHaveBeenCalledExactlyOnceWith({
        abortSignal: context.abortSignal,
        app: context.app,
        linkStyle: LINK_STYLE,
        newSourcePathOrFile: file,
        pluginNoticeComponent: context.pluginNoticeComponent,
        resourceLockComponent: context.resourceLockComponent
      });
    });

    it('should force the markdown style without consulting the setting when asked to', async () => {
      const context = createConverter();

      await context.converter.convertLinksInFile({
        file: createFile('note.md'),
        shouldForceMarkdownLinkStyle: true
      });

      expect(context.getLinkStyle).not.toHaveBeenCalled();
      expect(vi.mocked(updateLinksInFile).mock.calls[0]?.[0].linkStyle).toBe('Markdown');
    });

    it('should normalize file links after updating links when the setting is enabled', async () => {
      const context = createConverter({ shouldNormalizeFileLinks: true });
      const file = createFile('note.md');

      await context.converter.convertLinksInFile({ file });

      expect(vi.mocked(updateFileUrlLinksInFile)).toHaveBeenCalledExactlyOnceWith({
        abortSignal: context.abortSignal,
        app: context.app,
        pathOrFile: file,
        pluginNoticeComponent: context.pluginNoticeComponent,
        resourceLockComponent: context.resourceLockComponent,
        shouldUseAngleBrackets: true
      });
    });

    it('should not normalize file links when the setting is disabled', async () => {
      const context = createConverter({ shouldNormalizeFileLinks: false });

      await context.converter.convertLinksInFile({ file: createFile('note.md') });

      expect(vi.mocked(updateLinksInFile)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateFileUrlLinksInFile)).not.toHaveBeenCalled();
    });

    it('should skip an ignored file when not prompting', async () => {
      const context = createConverter();
      context.isPathIgnored.mockReturnValue(true);

      await context.converter.convertLinksInFile({ file: createFile('ignored.md') });

      expect(vi.mocked(confirm)).not.toHaveBeenCalled();
      expect(vi.mocked(updateLinksInFile)).not.toHaveBeenCalled();
    });

    it('should skip an ignored file when prompting and the user declines', async () => {
      const context = createConverter();
      context.isPathIgnored.mockReturnValue(true);
      vi.mocked(confirm).mockResolvedValue(false);

      await context.converter.convertLinksInFile({
        file: createFile('ignored.md'),
        shouldPromptForExcludedFile: true
      });

      expect(vi.mocked(confirm)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateLinksInFile)).not.toHaveBeenCalled();
    });

    it('should convert an ignored file when prompting and the user confirms', async () => {
      const context = createConverter();
      const file = createFile('ignored.md');
      context.isPathIgnored.mockReturnValue(true);
      vi.mocked(confirm).mockResolvedValue(true);

      await context.converter.convertLinksInFile({
        file,
        shouldPromptForExcludedFile: true
      });

      expect(vi.mocked(updateLinksInFile)).toHaveBeenCalledOnce();
    });

    describe('unresolved link resolution', () => {
      it('should not resolve unresolved links when the caller does not ask for it', async () => {
        const context = createConverter({ shouldCreateMissingNotes: true, shouldResolveLinksViaAliases: true });

        await context.converter.convertLinksInFile({ file: createFile('note.md') });

        expect(vi.mocked(resolveUnresolvedLinksInFile)).not.toHaveBeenCalled();
      });

      it('should not resolve unresolved links when both settings are disabled', async () => {
        const context = createConverter();

        await context.converter.convertLinksInFile({
          file: createFile('note.md'),
          shouldResolveUnresolvedLinks: true
        });

        expect(vi.mocked(resolveUnresolvedLinksInFile)).not.toHaveBeenCalled();
      });

      it('should resolve unresolved links before updating them when the alias setting is enabled', async () => {
        const context = createConverter({ shouldResolveLinksViaAliases: true });
        const file = createFile('note.md');

        await context.converter.convertLinksInFile({
          file,
          shouldResolveUnresolvedLinks: true
        });

        expect(vi.mocked(resolveUnresolvedLinksInFile)).toHaveBeenCalledExactlyOnceWith({
          abortSignal: context.abortSignal,
          app: context.app,
          file,
          pluginNoticeComponent: context.pluginNoticeComponent,
          resourceLockComponent: context.resourceLockComponent,
          shouldCreateMissingNotes: false,
          shouldResolveLinksViaAliases: true
        });
        expect(vi.mocked(resolveUnresolvedLinksInFile).mock.invocationCallOrder[0])
          .toBeLessThan(vi.mocked(updateLinksInFile).mock.invocationCallOrder[0] ?? 0);
      });

      it('should resolve unresolved links when only the create setting is enabled', async () => {
        const context = createConverter({ shouldCreateMissingNotes: true });

        await context.converter.convertLinksInFile({
          file: createFile('note.md'),
          shouldResolveUnresolvedLinks: true
        });

        expect(vi.mocked(resolveUnresolvedLinksInFile).mock.calls[0]?.[0]).toMatchObject({
          shouldCreateMissingNotes: true,
          shouldResolveLinksViaAliases: false
        });
      });

      it('should propagate the flag from the folder conversion to each file', async () => {
        const context = createConverter({ shouldResolveLinksViaAliases: true });
        const folder = strictProxy<TFolder>({ path: 'sub' });
        const file = createFile('sub/note.md');
        vi.mocked(loop).mockImplementation(async (params) => {
          await params.processItem(file);
        });

        await context.converter.convertLinksInFolder({
          folder,
          shouldResolveUnresolvedLinks: true
        });

        expect(vi.mocked(resolveUnresolvedLinksInFile)).toHaveBeenCalledOnce();
      });

      it('should not resolve unresolved links on a folder conversion that does not ask for it', async () => {
        const context = createConverter({ shouldResolveLinksViaAliases: true });
        const folder = strictProxy<TFolder>({ path: 'sub' });
        const file = createFile('sub/note.md');
        vi.mocked(loop).mockImplementation(async (params) => {
          await params.processItem(file);
        });

        await context.converter.convertLinksInFolder({ folder });

        expect(vi.mocked(resolveUnresolvedLinksInFile)).not.toHaveBeenCalled();
      });
    });
  });

  describe('convertLinksInFolder', () => {
    it('should loop over markdown files with the entire-vault progress title for the root folder', async () => {
      const context = createConverter();
      const folder = strictProxy<TFolder>({ path: '/' });
      const file = createFile('note.md');
      vi.mocked(getMarkdownFiles).mockReturnValue([file]);

      await context.converter.convertLinksInFolder({ folder });

      const loopParams = vi.mocked(loop).mock.calls[0]?.[0];
      expect(loopParams?.progressBarTitle).toBe('Better Markdown Links: Converting links in entire vault...');
      expect(vi.mocked(getMarkdownFiles)).toHaveBeenCalledWith({
        app: context.app,
        isRecursive: true,
        pathOrFolder: folder
      });
    });

    it('should use the folder-specific progress title for a non-root folder', async () => {
      const context = createConverter();
      const folder = strictProxy<TFolder>({ path: 'sub/folder' });

      await context.converter.convertLinksInFolder({ folder });

      const loopParams = vi.mocked(loop).mock.calls[0]?.[0];
      expect(loopParams?.progressBarTitle).toBe('Better Markdown Links: Converting links in folder "sub/folder" ...');
    });

    it('should say what it is doing and force the style on every file when converting to Markdown', async () => {
      const context = createConverter();
      const folder = strictProxy<TFolder>({ path: '/' });
      const file = createFile('note.md');
      vi.mocked(loop).mockImplementation(async (params) => {
        params.buildNoticeMessage({ item: file, iterationString: '1/1' });
        await params.processItem(file);
      });

      await context.converter.convertLinksInFolder({
        folder,
        shouldForceMarkdownLinkStyle: true
      });

      const loopParams = vi.mocked(loop).mock.calls[0]?.[0];
      expect(loopParams?.progressBarTitle).toBe('Better Markdown Links: Converting links to Markdown in entire vault...');
      expect(loopParams?.buildNoticeMessage({ item: file, iterationString: '1/1' }))
        .toBe('Converting links to Markdown in note 1/1 - note.md');
      expect(vi.mocked(updateLinksInFile).mock.calls[0]?.[0].linkStyle).toBe('Markdown');
    });

    it('should build a notice message and convert each looped file', async () => {
      const context = createConverter();
      const folder = strictProxy<TFolder>({ path: 'sub' });
      const file = createFile('sub/note.md');
      vi.mocked(loop).mockImplementation(async (params) => {
        params.buildNoticeMessage({ item: file, iterationString: '1/1' });
        await params.processItem(file);
      });

      await context.converter.convertLinksInFolder({ folder });

      expect(vi.mocked(updateLinksInFile)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateLinksInFile).mock.calls[0]?.[0].newSourcePathOrFile).toBe(file);
    });
  });
});
