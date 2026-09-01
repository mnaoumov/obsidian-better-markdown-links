import type {
  App,
  Reference,
  TFile,
  TFolder
} from 'obsidian';
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

vi.mock('obsidian', () => ({
  getLinkpath: vi.fn(),
  parseFrontMatterAliases: vi.fn(),
  Platform: { isWin: true }
}));

vi.mock('obsidian-dev-utils/obsidian/link', () => ({
  editLinks: vi.fn(),
  generateMarkdownLink: vi.fn(),
  hasWikilinkSyntax: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/vault', () => ({
  createFolderSafe: vi.fn(),
  getAvailablePath: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  getLinkpath,
  parseFrontMatterAliases,
  Platform
} from 'obsidian';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  editLinks,
  generateMarkdownLink,
  hasWikilinkSyntax
} from 'obsidian-dev-utils/obsidian/link';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  createFolderSafe,
  getAvailablePath
} from 'obsidian-dev-utils/obsidian/vault';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  normalizeAlias,
  resolveUnresolvedLinksInFile
} from './unresolved-link-resolver.ts';

interface PlatformMock {
  isWin: boolean;
}

const GENERATED_LINK = '[Some Alias](<Real Note.md>)';
const SOURCE_FILE_PATH = 'folder/note.md';

interface CreateContextOptions {
  readonly shouldCreateMissingNotes?: boolean;
  readonly shouldResolveLinksViaAliases?: boolean;
}

interface CreateContextResult {
  readonly abortSignal: AbortSignal;
  readonly app: App;
  readonly create: ReturnType<typeof vi.fn>;
  readonly file: TFile;
  readonly getFileCache: ReturnType<typeof vi.fn>;
  readonly getFirstLinkpathDestination: ReturnType<typeof vi.fn>;
  readonly getNewFileParent: ReturnType<typeof vi.fn>;
  readonly markdownFiles: TFile[];
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly resourceLockComponent: ResourceLockComponent;
  run(): Promise<void>;
}

function createContext(options: CreateContextOptions = {}): CreateContextResult {
  const abortSignal = new AbortController().signal;
  const markdownFiles: TFile[] = [];
  const getFirstLinkpathDestination = vi.fn<() => null | TFile>().mockReturnValue(null);
  const getFileCache = vi.fn().mockReturnValue({ frontmatter: {} });
  const getNewFileParent = vi.fn<() => TFolder>().mockReturnValue(strictProxy<TFolder>({ path: 'Inbox' }));
  const create = vi.fn<(path: string) => Promise<TFile>>();
  const app = strictProxy<App>({
    fileManager: { getNewFileParent },
    metadataCache: {
      getFileCache,
      // eslint-disable-next-line unicorn/name-replacements -- `getFirstLinkpathDest` is Obsidian's own API name; the mock must match it.
      getFirstLinkpathDest: getFirstLinkpathDestination
    },
    vault: {
      create,
      getMarkdownFiles: () => markdownFiles
    }
  });
  const file = createFile(SOURCE_FILE_PATH);
  const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});
  const resourceLockComponent = strictProxy<ResourceLockComponent>({});

  return {
    abortSignal,
    app,
    create,
    file,
    getFileCache,
    getFirstLinkpathDestination,
    getNewFileParent,
    markdownFiles,
    pluginNoticeComponent,
    resourceLockComponent,
    async run(): Promise<void> {
      await resolveUnresolvedLinksInFile({
        abortSignal,
        app,
        file,
        pluginNoticeComponent,
        resourceLockComponent,
        shouldCreateMissingNotes: options.shouldCreateMissingNotes ?? false,
        shouldResolveLinksViaAliases: options.shouldResolveLinksViaAliases ?? false
      });
    }
  };
}

function createFile(path: string, basename = path): TFile {
  return strictProxy<TFile>({ basename, path });
}

function createLink(original: string, displayText?: string): Reference {
  return castTo<Reference>({ displayText, link: 'Some Alias', original });
}

/**
 * Runs the converter callback the resolver handed to `editLinks` against one link, the way `editLinks`
 * itself would.
 */
async function runLinkConverter(link: Reference): Promise<string | undefined> {
  const editLinksParams = vi.mocked(editLinks).mock.calls[0]?.[0];
  return await editLinksParams?.linkConverter(link) as string | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  castTo<PlatformMock>(Platform).isWin = true;
  vi.mocked(editLinks).mockResolvedValue(undefined);
  vi.mocked(hasWikilinkSyntax).mockReturnValue(true);
  vi.mocked(getLinkpath).mockReturnValue('Some Alias');
  vi.mocked(parseFrontMatterAliases).mockReturnValue(null);
  vi.mocked(generateMarkdownLink).mockReturnValue(GENERATED_LINK);
  vi.mocked(createFolderSafe).mockResolvedValue(castTo({}));
  vi.mocked(getAvailablePath).mockImplementation((_app, path) => path);
});

describe('normalizeAlias', () => {
  it('should lowercase the alias', () => {
    expect(normalizeAlias('Some Alias')).toBe('some alias');
  });

  it('should collapse runs of two or more spaces', () => {
    expect(normalizeAlias('some    alias')).toBe('some alias');
  });

  it('should leave a single space alone', () => {
    expect(normalizeAlias('some alias')).toBe('some alias');
  });
});

describe('resolveUnresolvedLinksInFile', () => {
  it('should throw when the abort signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const context = createContext();

    await expect(resolveUnresolvedLinksInFile({
      abortSignal: controller.signal,
      app: context.app,
      file: context.file,
      pluginNoticeComponent: context.pluginNoticeComponent,
      resourceLockComponent: context.resourceLockComponent,
      shouldCreateMissingNotes: true,
      shouldResolveLinksViaAliases: true
    })).rejects.toThrow();
    expect(vi.mocked(editLinks)).not.toHaveBeenCalled();
  });

  it('should edit the links of the file', async () => {
    const context = createContext();

    await context.run();

    expect(vi.mocked(editLinks)).toHaveBeenCalledOnce();
    const editLinksParams = vi.mocked(editLinks).mock.calls[0]?.[0];
    expect(editLinksParams?.abortSignal).toBe(context.abortSignal);
    expect(editLinksParams?.app).toBe(context.app);
    expect(editLinksParams?.pathOrFile).toBe(context.file);
    expect(editLinksParams?.pluginNoticeComponent).toBe(context.pluginNoticeComponent);
    expect(editLinksParams?.resourceLockComponent).toBe(context.resourceLockComponent);
  });

  describe('the link converter it hands to editLinks', () => {
    it('should leave a markdown link alone', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      vi.mocked(hasWikilinkSyntax).mockReturnValue(false);
      await context.run();

      const result = await runLinkConverter(createLink('[Some Alias](<Some Alias.md>)'));

      expect(result).toBeUndefined();
      expect(context.getFirstLinkpathDestination).not.toHaveBeenCalled();
    });

    it('should leave a wikilink with an empty link path alone', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      vi.mocked(getLinkpath).mockReturnValue('');
      await context.run();

      const result = await runLinkConverter(createLink('[[#heading]]'));

      expect(result).toBeUndefined();
      expect(context.getFirstLinkpathDestination).not.toHaveBeenCalled();
    });

    it('should leave a wikilink Obsidian already resolves alone', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      context.getFirstLinkpathDestination.mockReturnValue(createFile('Some Alias.md'));
      await context.run();

      const result = await runLinkConverter(createLink('[[Some Alias]]'));

      expect(result).toBeUndefined();
      expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
    });

    it('should leave an unresolved wikilink alone when both strategies are disabled', async () => {
      const context = createContext();
      await context.run();

      const result = await runLinkConverter(createLink('[[Some Alias]]'));

      expect(result).toBeUndefined();
      expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
    });

    it('should resolve via a frontmatter alias', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      const aliasedFile = createFile('Real Note.md', 'Real Note');
      context.markdownFiles.push(createFile('Other.md', 'Other'), aliasedFile);
      vi.mocked(parseFrontMatterAliases).mockImplementation(() => null);
      context.getFileCache.mockImplementation((f: TFile) => f === aliasedFile ? { frontmatter: { aliases: ['Some Alias'] } } : { frontmatter: {} });
      vi.mocked(parseFrontMatterAliases).mockImplementation((frontmatter) => castTo<null | string[]>(castTo<Record<string, unknown>>(frontmatter)['aliases'] ?? null));
      await context.run();

      const result = await runLinkConverter(createLink('[[Some Alias]]', 'Some Alias'));

      expect(result).toBe(GENERATED_LINK);
      expect(vi.mocked(generateMarkdownLink)).toHaveBeenCalledExactlyOnceWith({
        alias: 'Some Alias',
        app: context.app,
        originalLink: '[[Some Alias]]',
        sourcePathOrFile: context.file,
        targetPathOrFile: aliasedFile
      });
    });

    it('should resolve via a basename when no frontmatter alias matches', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      const namedFile = createFile('Some Alias.md', 'Some Alias');
      context.markdownFiles.push(namedFile);
      await context.run();

      await runLinkConverter(createLink('[[Some Alias]]'));

      expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(namedFile);
    });

    it('should compare aliases in the normalized space', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      const namedFile = createFile('Some Alias.md', 'SOME    ALIAS');
      context.markdownFiles.push(namedFile);
      await context.run();

      await runLinkConverter(createLink('[[Some Alias]]'));

      expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(namedFile);
    });

    it('should pass an empty alias when the wikilink has no display text', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      context.markdownFiles.push(createFile('Some Alias.md', 'Some Alias'));
      await context.run();

      await runLinkConverter(createLink('[[Some Alias]]'));

      expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].alias).toBe('');
    });

    it('should not create a note when only the alias strategy is enabled', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      await context.run();

      const result = await runLinkConverter(createLink('[[Some Alias]]'));

      expect(result).toBeUndefined();
      expect(context.create).not.toHaveBeenCalled();
    });

    it('should create the missing note in the new-file parent folder', async () => {
      const context = createContext({ shouldCreateMissingNotes: true });
      const createdFile = createFile('Inbox/Some Alias.md', 'Some Alias');
      context.create.mockResolvedValue(createdFile);
      await context.run();

      const result = await runLinkConverter(createLink('[[Some Alias]]'));

      expect(context.getNewFileParent).toHaveBeenCalledWith(SOURCE_FILE_PATH);
      expect(vi.mocked(createFolderSafe)).toHaveBeenCalledWith(context.app, 'Inbox');
      expect(context.create).toHaveBeenCalledExactlyOnceWith('Inbox/Some Alias.md', '');
      expect(result).toBe(GENERATED_LINK);
      expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(createdFile);
    });

    it('should only create a note after the alias lookup fails', async () => {
      const context = createContext({ shouldCreateMissingNotes: true, shouldResolveLinksViaAliases: true });
      context.markdownFiles.push(createFile('Some Alias.md', 'Some Alias'));
      await context.run();

      await runLinkConverter(createLink('[[Some Alias]]'));

      expect(context.create).not.toHaveBeenCalled();
    });

    it('should strip platform-forbidden characters from the created note name', async () => {
      const context = createContext({ shouldCreateMissingNotes: true });
      vi.mocked(getLinkpath).mockReturnValue('a:b?c*d');
      context.create.mockResolvedValue(createFile('Inbox/abcd.md', 'abcd'));
      await context.run();

      await runLinkConverter(createLink('[[a:b?c*d]]'));

      expect(context.create).toHaveBeenCalledExactlyOnceWith('Inbox/abcd.md', '');
    });

    it('should strip only backslashes off Windows', async () => {
      castTo<PlatformMock>(Platform).isWin = false;
      const context = createContext({ shouldCreateMissingNotes: true });
      vi.mocked(getLinkpath).mockReturnValue('a:b');
      context.create.mockResolvedValue(createFile('Inbox/a:b.md', 'a:b'));
      await context.run();

      await runLinkConverter(createLink('[[a:b]]'));

      expect(context.create).toHaveBeenCalledExactlyOnceWith('Inbox/a:b.md', '');
    });

    it('should preserve folder separators so a subfolder note is created', async () => {
      const context = createContext({ shouldCreateMissingNotes: true });
      vi.mocked(getLinkpath).mockReturnValue('sub/Some Alias');
      context.create.mockResolvedValue(createFile('Inbox/sub/Some Alias.md', 'Some Alias'));
      await context.run();

      await runLinkConverter(createLink('[[sub/Some Alias]]'));

      expect(vi.mocked(createFolderSafe)).toHaveBeenCalledWith(context.app, 'Inbox/sub');
      expect(context.create).toHaveBeenCalledExactlyOnceWith('Inbox/sub/Some Alias.md', '');
    });

    it('should not create a note whose name is left empty by the stripping', async () => {
      const context = createContext({ shouldCreateMissingNotes: true });
      vi.mocked(getLinkpath).mockReturnValue('???');
      await context.run();

      const result = await runLinkConverter(createLink('[[???]]'));

      expect(result).toBeUndefined();
      expect(context.create).not.toHaveBeenCalled();
    });

    it('should use the available path so an existing note is never clobbered', async () => {
      const context = createContext({ shouldCreateMissingNotes: true });
      vi.mocked(getAvailablePath).mockReturnValue('Inbox/Some Alias 1.md');
      context.create.mockResolvedValue(createFile('Inbox/Some Alias 1.md', 'Some Alias 1'));
      await context.run();

      await runLinkConverter(createLink('[[Some Alias]]'));

      expect(vi.mocked(getAvailablePath)).toHaveBeenCalledWith(context.app, 'Inbox/Some Alias.md');
      expect(context.create).toHaveBeenCalledExactlyOnceWith('Inbox/Some Alias 1.md', '');
    });
  });
});
