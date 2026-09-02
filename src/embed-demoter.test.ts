import type {
  App,
  Reference,
  TFile,
  TFolder
} from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
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
  editLinks: vi.fn(),
  extractLinkFile: vi.fn(),
  generateMarkdownLink: vi.fn(),
  hasEmbedSyntax: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/loop', () => ({
  loop: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/modals/confirm', () => ({
  confirm: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { getMarkdownFiles } from 'obsidian-dev-utils/obsidian/file-system';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  editLinks,
  extractLinkFile,
  generateMarkdownLink,
  hasEmbedSyntax
} from 'obsidian-dev-utils/obsidian/link';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { loop } from 'obsidian-dev-utils/obsidian/loop';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { confirm } from 'obsidian-dev-utils/obsidian/modals/confirm';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { EmbedDemoter } from './embed-demoter.ts';

const GENERATED_LINK = '[Diagram](<Materials/Diagram.png>)';

interface CreateDemoterOptions {
  readonly shouldAppendFileNameWhenDemotingEmbeds?: boolean;
}

interface CreateDemoterResult {
  readonly abortSignal: AbortSignal;
  readonly app: App;
  readonly demoter: EmbedDemoter;
  readonly isPathIgnored: ReturnType<typeof vi.fn>;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly resourceLockComponent: ResourceLockComponent;
}

function createDemoter(options: CreateDemoterOptions = {}): CreateDemoterResult {
  const abortSignal = new AbortController().signal;
  const abortSignalComponent = strictProxy<AbortSignalComponent>({ abortSignal });
  const app = strictProxy<App>({});
  const isPathIgnored = vi.fn<(path: string) => boolean>().mockReturnValue(false);
  const settings = strictProxy<PluginSettings>({
    isPathIgnored,
    shouldAppendFileNameWhenDemotingEmbeds: options.shouldAppendFileNameWhenDemotingEmbeds ?? false
  });
  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({ settings });
  const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});
  const resourceLockComponent = strictProxy<ResourceLockComponent>({});

  const demoter = new EmbedDemoter({
    abortSignalComponent,
    app,
    pluginNoticeComponent,
    pluginSettingsComponent,
    resourceLockComponent
  });

  return {
    abortSignal,
    app,
    demoter,
    isPathIgnored,
    pluginNoticeComponent,
    resourceLockComponent
  };
}

function createFile(path: string, name = path): TFile {
  return strictProxy<TFile>({ name, path });
}

function createLink(original: string, displayText?: string): Reference {
  return castTo<Reference>({ displayText, link: 'Materials/Diagram.png', original });
}

/**
 * Runs the converter callback the demoter handed to `editLinks` against one link, the way `editLinks`
 * itself would.
 */
async function runLinkConverter(link: Reference): Promise<string | undefined> {
  const editLinksParams = vi.mocked(editLinks).mock.calls[0]?.[0];
  return await editLinksParams?.linkConverter(link) as string | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(abortSignalAny).mockImplementation((...signals) => signals[0] ?? new AbortController().signal);
  vi.mocked(editLinks).mockResolvedValue(undefined);
  vi.mocked(loop).mockResolvedValue(undefined);
  vi.mocked(getMarkdownFiles).mockReturnValue([]);
  vi.mocked(hasEmbedSyntax).mockReturnValue(true);
  vi.mocked(generateMarkdownLink).mockReturnValue(GENERATED_LINK);
});

describe('EmbedDemoter', () => {
  describe('demoteEmbedsInFile', () => {
    it('should throw when the combined abort signal is already aborted', async () => {
      const context = createDemoter();
      const controller = new AbortController();
      controller.abort();
      vi.mocked(abortSignalAny).mockReturnValue(controller.signal);

      await expect(context.demoter.demoteEmbedsInFile({ file: createFile('note.md') })).rejects.toThrow();
      expect(vi.mocked(editLinks)).not.toHaveBeenCalled();
    });

    it('should edit the links of a non-ignored file', async () => {
      const context = createDemoter();
      const file = createFile('note.md');

      await context.demoter.demoteEmbedsInFile({ file });

      expect(vi.mocked(editLinks)).toHaveBeenCalledOnce();
      const editLinksParams = vi.mocked(editLinks).mock.calls[0]?.[0];
      expect(editLinksParams?.abortSignal).toBe(context.abortSignal);
      expect(editLinksParams?.app).toBe(context.app);
      expect(editLinksParams?.pathOrFile).toBe(file);
      expect(editLinksParams?.pluginNoticeComponent).toBe(context.pluginNoticeComponent);
      expect(editLinksParams?.resourceLockComponent).toBe(context.resourceLockComponent);
    });

    it('should skip an ignored file when not prompting', async () => {
      const context = createDemoter();
      context.isPathIgnored.mockReturnValue(true);

      await context.demoter.demoteEmbedsInFile({ file: createFile('ignored.md') });

      expect(vi.mocked(confirm)).not.toHaveBeenCalled();
      expect(vi.mocked(editLinks)).not.toHaveBeenCalled();
    });

    it('should skip an ignored file when prompting and the user declines', async () => {
      const context = createDemoter();
      context.isPathIgnored.mockReturnValue(true);
      vi.mocked(confirm).mockResolvedValue(false);

      await context.demoter.demoteEmbedsInFile({
        file: createFile('ignored.md'),
        shouldPromptForExcludedFile: true
      });

      expect(vi.mocked(confirm)).toHaveBeenCalledOnce();
      expect(vi.mocked(editLinks)).not.toHaveBeenCalled();
    });

    it('should demote an ignored file when prompting and the user confirms', async () => {
      const context = createDemoter();
      context.isPathIgnored.mockReturnValue(true);
      vi.mocked(confirm).mockResolvedValue(true);

      await context.demoter.demoteEmbedsInFile({
        file: createFile('ignored.md'),
        shouldPromptForExcludedFile: true
      });

      expect(vi.mocked(editLinks)).toHaveBeenCalledOnce();
    });

    describe('the link converter it hands to editLinks', () => {
      it('should leave a link that is not an embed alone', async () => {
        const context = createDemoter();
        vi.mocked(hasEmbedSyntax).mockReturnValue(false);
        await context.demoter.demoteEmbedsInFile({ file: createFile('note.md') });

        const result = await runLinkConverter(createLink('[[Materials/Diagram.png]]'));

        expect(result).toBeUndefined();
        expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
      });

      it('should leave an embed whose target cannot be extracted alone', async () => {
        const context = createDemoter();
        vi.mocked(extractLinkFile).mockReturnValue(null);
        await context.demoter.demoteEmbedsInFile({ file: createFile('note.md') });

        const result = await runLinkConverter(createLink('![[missing.png]]'));

        expect(result).toBeUndefined();
        expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
      });

      it('should generate a non-embed link that preserves the original style and alias', async () => {
        const context = createDemoter();
        const file = createFile('note.md');
        const targetFile = createFile('Materials/Diagram.png', 'Diagram.png');
        vi.mocked(extractLinkFile).mockReturnValue(targetFile);
        await context.demoter.demoteEmbedsInFile({ file });

        const result = await runLinkConverter(createLink('![Diagram](<Materials/Diagram.png>)', 'Diagram'));

        expect(result).toBe(GENERATED_LINK);
        expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledExactlyOnceWith({
          alias: 'Diagram',
          app: context.app,
          isEmbed: false,
          originalLink: '![Diagram](<Materials/Diagram.png>)',
          sourcePathOrFile: file,
          targetPathOrFile: targetFile
        });
      });

      it('should pass an empty alias when the embed has no display text', async () => {
        const context = createDemoter();
        vi.mocked(extractLinkFile).mockReturnValue(createFile('Materials/Diagram.png', 'Diagram.png'));
        await context.demoter.demoteEmbedsInFile({ file: createFile('note.md') });

        await runLinkConverter(createLink('![[Materials/Diagram.png]]'));

        expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].alias).toBe('');
      });

      it('should append the target file name as a sub-bullet when the setting is enabled', async () => {
        const context = createDemoter({ shouldAppendFileNameWhenDemotingEmbeds: true });
        vi.mocked(extractLinkFile).mockReturnValue(createFile('Materials/Diagram.png', 'Diagram.png'));
        await context.demoter.demoteEmbedsInFile({ file: createFile('note.md') });

        const result = await runLinkConverter(createLink('![[Materials/Diagram.png]]'));

        expect(result).toBe(`${GENERATED_LINK}\n  - Diagram.png`);
      });
    });
  });

  describe('demoteEmbedsInFolder', () => {
    it('should loop over markdown files with the entire-vault progress title for the root folder', async () => {
      const context = createDemoter();
      const folder = strictProxy<TFolder>({ path: '/' });

      await context.demoter.demoteEmbedsInFolder({ folder });

      const loopParams = vi.mocked(loop).mock.calls[0]?.[0];
      expect(loopParams?.progressBarTitle).toBe('Better Markdown Links: Demoting embeds to links in entire vault...');
      expect(vi.mocked(getMarkdownFiles)).toHaveBeenCalledWith({
        app: context.app,
        isRecursive: true,
        pathOrFolder: folder
      });
    });

    it('should use the folder-specific progress title for a non-root folder', async () => {
      const context = createDemoter();
      const folder = strictProxy<TFolder>({ path: 'sub/folder' });

      await context.demoter.demoteEmbedsInFolder({ folder });

      const loopParams = vi.mocked(loop).mock.calls[0]?.[0];
      expect(loopParams?.progressBarTitle).toBe('Better Markdown Links: Demoting embeds to links in folder "sub/folder" ...');
    });

    it('should build a notice message and demote each looped file', async () => {
      const context = createDemoter();
      const folder = strictProxy<TFolder>({ path: 'sub' });
      const file = createFile('sub/note.md');
      vi.mocked(loop).mockImplementation(async (params) => {
        params.buildNoticeMessage({ item: file, iterationString: '1/1' });
        await params.processItem(file);
      });

      await context.demoter.demoteEmbedsInFolder({ folder });

      expect(vi.mocked(editLinks)).toHaveBeenCalledOnce();
      expect(vi.mocked(editLinks).mock.calls[0]?.[0].pathOrFile).toBe(file);
    });
  });
});
