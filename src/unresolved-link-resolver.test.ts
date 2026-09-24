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

vi.mock('obsidian-dev-utils/obsidian/file-system', () => ({
  getFileOrNull: vi.fn(),
  isMarkdownFile: vi.fn()
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
  getFileOrNull,
  isMarkdownFile
} from 'obsidian-dev-utils/obsidian/file-system';
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
  /**
   * Whether `metadataCache.getLinkSuggestions` carries the `getPathsByNameSafe` graft, i.e. whether
   * the `Advanced Metadata Cache` plugin's `Names` module is on.
   */
  readonly isNameIndexInstalled?: boolean;

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
  readonly getPathsByNameSafe: ReturnType<typeof vi.fn>;
  readonly markdownFiles: TFile[];
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly resourceLockComponent: ResourceLockComponent;
  readonly run: () => Promise<void>;
}

function createContext(options: CreateContextOptions = {}): CreateContextResult {
  const abortSignal = new AbortController().signal;
  const markdownFiles: TFile[] = [];
  const getFirstLinkpathDestination = vi.fn<() => null | TFile>().mockReturnValue(null);
  const getFileCache = vi.fn().mockReturnValue({ frontmatter: {} });
  const getNewFileParent = vi.fn<() => TFolder>().mockReturnValue(strictProxy<TFolder>({ path: 'Inbox' }));
  const create = vi.fn<(path: string) => Promise<TFile>>();
  const getPathsByNameSafe = vi.fn<(name: string) => Promise<string[]>>().mockResolvedValue([]);
  // Core's own method, with the `Names` module's graft on it or without, which is the whole of what
  // this plugin looks at to decide which implementation it has.
  const getLinkSuggestions = options.isNameIndexInstalled
    ? Object.assign(vi.fn(), { getPathsByNameSafe })
    : vi.fn();
  const app = strictProxy<App>({
    fileManager: { getNewFileParent },
    metadataCache: {
      getFileCache,
      // eslint-disable-next-line unicorn/name-replacements -- `getFirstLinkpathDest` is Obsidian's own API name; the mock must match it.
      getFirstLinkpathDest: getFirstLinkpathDestination,
      getLinkSuggestions: castTo(getLinkSuggestions)
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
    getPathsByNameSafe,
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
  vi.mocked(isMarkdownFile).mockImplementation((pathOrFile) => typeof pathOrFile === 'string' && pathOrFile.endsWith('.md'));
  vi.mocked(getFileOrNull).mockReturnValue(null);
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

    it('should leave the link alone when several notes in the vault carry the name', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      context.markdownFiles.push(createFile('Some Alias.md', 'Some Alias'), createFile('Other/Some Alias.md', 'Some Alias'));
      await context.run();

      const result = await runLinkConverter(createLink('[[Some Alias]]'));

      // The walk used to stop at the first match and rewrite the link to it. It now has to see the
      // whole vault to know the name is unique, and declines to guess when it is not.
      expect(result).toBeUndefined();
      expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
    });

    it('should count a basename on one note and a frontmatter alias on another as an ambiguity', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      const aliasedFile = createFile('Real Note.md', 'Real Note');
      context.markdownFiles.push(createFile('Some Alias.md', 'Some Alias'), aliasedFile);
      context.getFileCache.mockImplementation((f: TFile) => f === aliasedFile ? { frontmatter: { aliases: ['Some Alias'] } } : { frontmatter: {} });
      vi.mocked(parseFrontMatterAliases).mockImplementation((frontmatter) => castTo<null | string[]>(castTo<Record<string, unknown>>(frontmatter)['aliases'] ?? null));
      await context.run();

      const result = await runLinkConverter(createLink('[[Some Alias]]'));

      expect(result).toBeUndefined();
      expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
    });

    it('should count one note once when both its basename and one of its aliases carry the name', async () => {
      const context = createContext({ shouldResolveLinksViaAliases: true });
      const namedFile = createFile('Some Alias.md', 'Some Alias');
      context.markdownFiles.push(namedFile);
      context.getFileCache.mockReturnValue({ frontmatter: { aliases: ['Some Alias'] } });
      vi.mocked(parseFrontMatterAliases).mockReturnValue(['Some Alias']);
      await context.run();

      await runLinkConverter(createLink('[[Some Alias]]'));

      // One NOTE is what counts, not one match. A note matching twice is not two candidates.
      expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(namedFile);
    });

    it('should not create a note for a name several notes in the vault carry', async () => {
      const context = createContext({ shouldCreateMissingNotes: true, shouldResolveLinksViaAliases: true });
      context.markdownFiles.push(createFile('Some Alias.md', 'Some Alias'), createFile('Other/Some Alias.md', 'Some Alias'));
      await context.run();

      const result = await runLinkConverter(createLink('[[Some Alias]]'));

      expect(result).toBeUndefined();
      expect(context.create).not.toHaveBeenCalled();
    });

    describe('the name index, when the Advanced Metadata Cache plugin has grafted it on', () => {
      it('should resolve through the index rather than by walking the vault', async () => {
        const context = createContext({ isNameIndexInstalled: true, shouldResolveLinksViaAliases: true });
        const indexedFile = createFile('Real Note.md', 'Real Note');
        // A note the WALK would find, so a pass here cannot be the walk answering.
        context.markdownFiles.push(createFile('Some Alias.md', 'Some Alias'));
        context.getPathsByNameSafe.mockResolvedValue(['Real Note.md']);
        vi.mocked(getFileOrNull).mockReturnValue(indexedFile);
        await context.run();

        await runLinkConverter(createLink('[[Some Alias]]'));

        // The RAW link text, not the normalized one: the index normalizes its own keys.
        expect(context.getPathsByNameSafe).toHaveBeenCalledExactlyOnceWith('Some Alias');
        expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(indexedFile);
      });

      it('should leave the link alone when the index names several notes', async () => {
        const context = createContext({ isNameIndexInstalled: true, shouldResolveLinksViaAliases: true });
        const firstFile = createFile('First.md', 'First');
        const secondFile = createFile('Second.md', 'Second');
        context.getPathsByNameSafe.mockResolvedValue(['First.md', 'Second.md']);
        vi.mocked(getFileOrNull).mockImplementation((params) => params.pathOrFile === 'First.md' ? firstFile : secondFile);
        await context.run();

        const result = await runLinkConverter(createLink('[[Some Alias]]'));

        expect(result).toBeUndefined();
        expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
      });

      it('should not create a note for a name the index says several notes carry', async () => {
        const context = createContext({
          isNameIndexInstalled: true,
          shouldCreateMissingNotes: true,
          shouldResolveLinksViaAliases: true
        });
        const firstFile = createFile('First.md', 'First');
        const secondFile = createFile('Second.md', 'Second');
        context.getPathsByNameSafe.mockResolvedValue(['First.md', 'Second.md']);
        vi.mocked(getFileOrNull).mockImplementation((params) => params.pathOrFile === 'First.md' ? firstFile : secondFile);
        await context.run();

        const result = await runLinkConverter(createLink('[[Some Alias]]'));

        // An ambiguous name is not a missing one. Creating a third note that answers to it would be
        // strictly worse than the arbitrary pick this behavior replaced.
        expect(result).toBeUndefined();
        expect(context.create).not.toHaveBeenCalled();
      });

      // Also proves the markdown narrowing decides AMBIGUITY and not only resolution: two paths come
      // back, one of them survives it, and the link resolves rather than being declined as contested.
      it('should skip a non-markdown path the index names', async () => {
        const context = createContext({ isNameIndexInstalled: true, shouldResolveLinksViaAliases: true });
        const note = createFile('Real Note.md', 'Real Note');
        context.getPathsByNameSafe.mockResolvedValue(['Board.canvas', 'Real Note.md']);
        vi.mocked(getFileOrNull).mockReturnValue(note);
        await context.run();

        await runLinkConverter(createLink('[[Some Alias]]'));

        expect(vi.mocked(getFileOrNull)).toHaveBeenCalledExactlyOnceWith({ app: context.app, pathOrFile: 'Real Note.md' });
        expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(note);
      });

      // Same point as the case above, from the other side: a path the vault has since lost must not
      // make a unique name look contested.
      it('should skip a path no file answers to', async () => {
        const context = createContext({ isNameIndexInstalled: true, shouldResolveLinksViaAliases: true });
        const note = createFile('Real Note.md', 'Real Note');
        context.getPathsByNameSafe.mockResolvedValue(['Gone.md', 'Real Note.md']);
        vi.mocked(getFileOrNull).mockImplementation((params) => params.pathOrFile === 'Real Note.md' ? note : null);
        await context.run();

        await runLinkConverter(createLink('[[Some Alias]]'));

        expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(note);
      });

      it('should take an empty index answer as final rather than falling back to the walk', async () => {
        const context = createContext({ isNameIndexInstalled: true, shouldResolveLinksViaAliases: true });
        context.markdownFiles.push(createFile('Some Alias.md', 'Some Alias'));
        context.getPathsByNameSafe.mockResolvedValue([]);
        await context.run();

        const result = await runLinkConverter(createLink('[[Some Alias]]'));

        expect(result).toBeUndefined();
        expect(vi.mocked(generateMarkdownLink)).not.toHaveBeenCalled();
      });

      it('should still create the missing note when the index names nothing', async () => {
        const context = createContext({
          isNameIndexInstalled: true,
          shouldCreateMissingNotes: true,
          shouldResolveLinksViaAliases: true
        });
        const createdFile = createFile('Inbox/Some Alias.md', 'Some Alias');
        context.create.mockResolvedValue(createdFile);
        await context.run();

        await runLinkConverter(createLink('[[Some Alias]]'));

        expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(createdFile);
      });

      it('should walk the vault when the graft is absent', async () => {
        const context = createContext({ shouldResolveLinksViaAliases: true });
        const namedFile = createFile('Some Alias.md', 'Some Alias');
        context.markdownFiles.push(namedFile);
        await context.run();

        await runLinkConverter(createLink('[[Some Alias]]'));

        expect(context.getPathsByNameSafe).not.toHaveBeenCalled();
        expect(vi.mocked(generateMarkdownLink).mock.calls[0]?.[0].targetPathOrFile).toBe(namedFile);
      });
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
