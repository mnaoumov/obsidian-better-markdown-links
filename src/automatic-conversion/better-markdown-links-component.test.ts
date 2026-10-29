import type { AbortSignalComponent } from '@mnaoumov/obsidian-lib/components/abort-signal-component';
import type { ConsoleDebugComponent } from '@mnaoumov/obsidian-lib/components/console-debug-component';
import type {
  LinkPathStyle,
  LinkStyle
} from '@mnaoumov/obsidian-lib/link';
import type { CachedMetadataEx } from '@mnaoumov/obsidian-lib/metadata-cache';
import type {
  App,
  Pos,
  Reference,
  TAbstractFile,
  TFile
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  App as AppCls,
  TFile as TFileCls,
  TFolder as TFolderCls
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { LinkConverter } from '../conversion/link-converter.ts';
import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import type { PluginSettings } from '../settings/plugin-settings.ts';

// These factories only stub the return values of pure utility functions the component reads
// (allowed thin `vi.fn()` stubs). The obsidian-lib base classes (LayoutReadyComponent,
// MonkeyAroundComponent, GenerateMarkdownLinkDefaultParamsComponent) and the plugin's own patch
// siblings are intentionally NOT mocked, so they run for real against the configured app.
vi.mock('@mnaoumov/typescript-lib/abort-controller', () => ({
  abortSignalAny: vi.fn()
}));

// Stub only the return value of the pure utility handleSilentError so the silent/non-silent branches
// of the openLinkText patch handler can be exercised. convertAsyncToSync keeps its real behavior
// (re-exported via importOriginal) so the real layout-ready/event wiring runs unchanged.
vi.mock('@mnaoumov/typescript-lib/async', async (importOriginal) => ({
  ...await importOriginal<typeof import('@mnaoumov/typescript-lib/async')>(),
  handleSilentError: vi.fn()
}));

// Stub only the return value of the pure utility convertLink. getGenerateMarkdownLinkDefaultParamsFns
// (same module) keeps its real implementation so the real default-params wiring is observable.
vi.mock('@mnaoumov/obsidian-lib/link', async (importOriginal) => ({
  ...await importOriginal<typeof import('@mnaoumov/obsidian-lib/link')>(),
  convertLink: vi.fn()
}));

// The predicate is getLinkTargetExclusionPredicate's, pinned in its own suite; this one asks only that the
// probe honours whatever it answers.
vi.mock('../conversion/link-target-exclusion.ts', () => ({
  getLinkTargetExclusionPredicate: vi.fn()
}));

vi.mock('@mnaoumov/obsidian-lib/metadata-cache', () => ({
  getReferences: vi.fn(),
  parseMetadata: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  convertLink,
  getGenerateMarkdownLinkDefaultParamsFns
} from '@mnaoumov/obsidian-lib/link';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  getReferences,
  parseMetadata
} from '@mnaoumov/obsidian-lib/metadata-cache';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { abortSignalAny } from '@mnaoumov/typescript-lib/abort-controller';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { handleSilentError } from '@mnaoumov/typescript-lib/async';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { getLinkTargetExclusionPredicate } from '../conversion/link-target-exclusion.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { BetterMarkdownLinksComponent } from './better-markdown-links-component.ts';

interface CommandsHolder {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The fixture installs its command stub after creating the app.
  commands: CommandsStub;
}

interface CommandsStub {
  readonly findCommand: (commandId: string) => unknown;
}

type ConfiguredFiles = NonNullable<Parameters<typeof AppCls.createConfigured__>[0]>['files'];

/**
 * The on-disk content of the seeded notes. Its shape is irrelevant — `parseMetadata` is mocked — but it
 * is what the probe is asserted to have passed along, so it must not be empty.
 */
const NOTE_CONTENT = 'note content';

interface CreateContextOptions {
  readonly generatedLinkPathStyle?: LinkPathStyle;
  readonly generatedLinkStyle?: LinkStyle;
  readonly shouldNormalizeFileLinks?: boolean;
}

interface DeletedHolder {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Tests simulate a file being deleted after its conversion starts.
  deleted: boolean;
}

interface HandleModifyHolder {
  readonly handleModify: (file: TAbstractFile) => Promise<void>;
}

interface MutableAbortSignalHolder {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Tests replace the signal to exercise cancellation during conversion.
  abortSignal: AbortSignal;
}

interface ProcessFileAbortControllersHolder {
  readonly processFileAbortControllers: Map<string, AbortController>;
}

interface TestContext {
  readonly abortSignalComponent: AbortSignalComponent;
  readonly app: App;
  readonly appMock: ReturnType<typeof AppCls.createConfigured__>;
  readonly component: BetterMarkdownLinksComponent;
  readonly consoleDebug: ReturnType<typeof vi.fn>;
  readonly convertLinksInFile: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFile']>>;
  readonly isPathIgnored: ReturnType<typeof vi.fn>;
  readonly settings: PluginSettings;
  readonly shouldConvertLinksOnModify: ReturnType<typeof vi.fn<() => boolean>>;
  readonly shouldConvertLinksOnNavigation: ReturnType<typeof vi.fn<() => boolean>>;
  readonly shouldConvertLinksOnSave: ReturnType<typeof vi.fn<(isSaveCommand: boolean) => boolean>>;
}

/**
 * The notes every scenario below drives `processFile` with. They are seeded into the configured App mock
 * unconditionally because the probe reads the note's content for real (`Vault.cachedRead`) before handing
 * it to the mocked `parseMetadata`; a detached `TFile` with no note behind it fails that read.
 */
const DEFAULT_FILES: ConfiguredFiles = {
  'ignored.md': NOTE_CONTENT,
  'note.md': NOTE_CONTENT
};

function createContext(files: ConfiguredFiles = {}, options: CreateContextOptions = {}): TestContext {
  const appMock = AppCls.createConfigured__({
    files: {
      ...DEFAULT_FILES,
      ...files
    }
  });
  // Seed a stub `commands` on the configured App mock, which lacks one.
  // The real `EditorSaveFileCommandPatchComponent` reads `app.commands.findCommand` in `onload`.
  // Returning no command keeps this test focused; that patch has its own dedicated test.
  castTo<CommandsHolder>(appMock).commands = {
    findCommand: vi.fn().mockReturnValue(undefined)
  };
  const app = appMock.asOriginalType__();

  const abortSignalComponent = strictProxy<AbortSignalComponent>({
    abortSignal: new AbortController().signal
  });
  const consoleDebug = vi.fn();
  const consoleDebugComponent = strictProxy<ConsoleDebugComponent>({ consoleDebug });
  const isPathIgnored = vi.fn<(path: string) => boolean>().mockReturnValue(false);
  const shouldConvertLinksOnModify = vi.fn<() => boolean>().mockReturnValue(true);
  const shouldConvertLinksOnNavigation = vi.fn<() => boolean>().mockReturnValue(true);
  const shouldConvertLinksOnSave = vi.fn<(isSaveCommand: boolean) => boolean>().mockReturnValue(true);
  const settings = strictProxy<PluginSettings>({
    // The decoration half belongs to `PluginSettings` and is pinned in its own suite; what this one cares
    // about is that whatever comes back reaches the `convertLink` probe.
    buildLinkPathStyleParams: vi.fn((linkPathStyle: LinkPathStyle) => ({ linkPathStyle })),
    getGeneratedLinkPathStyle: vi.fn().mockReturnValue(options.generatedLinkPathStyle),
    getGeneratedLinkStyle: vi.fn().mockReturnValue(options.generatedLinkStyle),
    getLinkPathStyle: vi.fn().mockReturnValue('ObsidianSettingsDefault'),
    getLinkStyle: vi.fn().mockReturnValue('ObsidianSettingsDefault'),
    isPathIgnored,
    shouldAllowEmptyEmbedAlias: false,
    shouldConvertFrontmatterWikilinksToMarkdown: false,
    shouldConvertLinksOnModify,
    shouldConvertLinksOnNavigation,
    shouldConvertLinksOnSave,
    shouldIncludeAttachmentExtensionToEmbedAlias: true,
    shouldNormalizeFileLinks: options.shouldNormalizeFileLinks ?? true,
    shouldUseAngleBrackets: false,
    shouldUseLeadingDotForRelativePaths: false,
    shouldUseLeadingSlashForAbsolutePaths: true
  });
  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({ settings });
  const convertLinksInFile = vi.fn<LinkConverter['convertLinksInFile']>().mockResolvedValue(undefined);
  const linkConverter = strictProxy<LinkConverter>({ convertLinksInFile });

  const component = new BetterMarkdownLinksComponent({
    abortSignalComponent,
    app,
    consoleDebugComponent,
    linkConverter,
    pluginSettingsComponent
  });

  return {
    abortSignalComponent,
    app,
    appMock,
    component,
    consoleDebug,
    convertLinksInFile,
    isPathIgnored,
    settings,
    shouldConvertLinksOnModify,
    shouldConvertLinksOnNavigation,
    shouldConvertLinksOnSave
  };
}

const loadedComponents: BetterMarkdownLinksComponent[] = [];

function getProcessFileAbortControllers(component: BetterMarkdownLinksComponent): Map<string, AbortController> {
  return castTo<ProcessFileAbortControllersHolder>(component).processFileAbortControllers;
}

function handleModify(component: BetterMarkdownLinksComponent, file: TAbstractFile): Promise<void> {
  return castTo<HandleModifyHolder>(component).handleModify(file);
}

/**
 * Drives the REAL `LayoutReadyComponent` lifecycle: `load()` registers the workspace layout-ready
 * callback, `setLayoutReady__()` fires it (scheduling the internal `setTimeout(0)`), and
 * `runAllTimers()` runs the deferred real `onLayoutReady()` synchronously. This applies the real
 * `Workspace.prototype.openLinkText` patch and wires the default-params + vault `modify` handlers.
 * The component is tracked so `afterEach` can `unload()` it, removing the real prototype patch so it
 * does not leak into the next test.
 */
function loadComponent(context: TestContext): void {
  loadedComponents.push(context.component);
  context.component.load();
  context.appMock.workspace.setLayoutReady__();
  vi.runAllTimers();
}

const realVault = AppCls.createConfigured__().vault;

function makeCacheWithExternalLinks(isFileUrl: boolean, location: 'body' | 'frontmatter' | 'multiValueFrontmatter'): CachedMetadataEx {
  const reference = { parseLinkResult: { isFileUrl } };
  const key = {
    body: 'externalLinks',
    frontmatter: 'frontmatterExternalLinks',
    multiValueFrontmatter: 'multiValueFrontmatterExternalLinks'
  }[location];
  return castTo<CachedMetadataEx>({
    features: [],
    [key]: [reference]
  });
}

function makeLink(original: string): Reference {
  return castTo<Reference>({ original });
}

/**
 * A heading spanning offsets 0-30, for the probe's heading skip. `isReferenceInHeading` is NOT mocked, so the
 * probe is asked the real question against these positions.
 */
const HEADING_CACHE = {
  features: [],
  headings: [{ position: makePosition(0, 30) }]
};

function makePosition(startOffset: number, endOffset: number): Pos {
  return {
    end: { col: endOffset, line: 0, offset: endOffset },
    start: { col: startOffset, line: 0, offset: startOffset }
  };
}

function makePositionedLink(original: string, startOffset: number, endOffset: number): Reference {
  return castTo<Reference>({ original, position: makePosition(startOffset, endOffset) });
}

function makeTFile(path: string): TFile {
  return castTo<TFile>(TFileCls.create__(realVault, path));
}

function makeTFolder(path: string): TAbstractFile {
  return castTo<TAbstractFile>(TFolderCls.create__(realVault, path));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  activeDocument.body.replaceChildren();
  vi.mocked(abortSignalAny).mockImplementation((...signals) => signals[0] ?? new AbortController().signal);
  vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadataEx>({ features: [] }));
  vi.mocked(getReferences).mockReturnValue([]);
  vi.mocked(convertLink).mockReturnValue('converted');
  vi.mocked(handleSilentError).mockReturnValue(false);
  vi.mocked(getLinkTargetExclusionPredicate).mockReturnValue(null);
});

afterEach(() => {
  while (loadedComponents.length > 0) {
    loadedComponents.pop()?.unload();
  }
  vi.useRealTimers();
});

describe('BetterMarkdownLinksComponent', () => {
  describe('onLayoutReady', () => {
    it('should register the vault modify handler and apply the openLinkText patch', () => {
      const context = createContext();
      const onSpy = vi.spyOn(context.app.vault, 'on');

      loadComponent(context);

      expect(onSpy).toHaveBeenCalledWith('modify', expect.any(Function));
    });

    it('should map the plugin settings to default link generation params', () => {
      const context = createContext();

      loadComponent(context);

      const fns = getGenerateMarkdownLinkDefaultParamsFns();
      const lastFunction = fns.at(-1);
      // `shouldAllowEmptyEmbedAlias` must be exposed under the obsidian-lib name `isEmptyEmbedAliasAllowed`;
      // Returning the settings object verbatim silently dropped it (the field names differ).
      expect(lastFunction?.()).toEqual({
        isEmptyEmbedAliasAllowed: false,
        shouldIncludeAttachmentExtensionToEmbedAlias: true,
        shouldUseAngleBrackets: false,
        shouldUseLeadingDotForRelativePaths: false,
        shouldUseLeadingSlashForAbsolutePaths: true
      });
      // No `linkStyle` KEY at all, not a `linkStyle: undefined`: these params are merged with
      // `Object.assign`, so the key would clobber a style another plugin's function had set.
      expect(lastFunction?.()).not.toHaveProperty('linkStyle');
      // The same argument, one axis over.
      expect(lastFunction?.()).not.toHaveProperty('linkPathStyle');
    });

    it('should carry the forced markdown style into the default link generation params', () => {
      const context = createContext({}, { generatedLinkStyle: castTo<LinkStyle>('Markdown') });

      loadComponent(context);

      expect(getGenerateMarkdownLinkDefaultParamsFns().at(-1)?.()).toMatchObject({ linkStyle: 'Markdown' });
    });

    it('should carry the forced link path style into the default link generation params', () => {
      const context = createContext({}, { generatedLinkPathStyle: castTo<LinkPathStyle>('RelativePathToTheSource') });

      loadComponent(context);

      expect(getGenerateMarkdownLinkDefaultParamsFns().at(-1)?.()).toMatchObject({ linkPathStyle: 'RelativePathToTheSource' });
    });
  });

  describe('handleModify', () => {
    it('should throw when the plugin abort signal is already aborted', async () => {
      const context = createContext();
      const controller = new AbortController();
      controller.abort();
      castTo<MutableAbortSignalHolder>(context.abortSignalComponent).abortSignal = controller.signal;

      await expect(handleModify(context.component, makeTFile('note.md'))).rejects.toThrow();
    });

    it('should ignore non-file abstract files', async () => {
      const context = createContext();

      await handleModify(context.component, makeTFolder('folder'));

      expect(vi.mocked(parseMetadata)).not.toHaveBeenCalled();
    });

    it('should abort an in-progress conversion for the same file', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      const existingController = new AbortController();
      const abortSpy = vi.spyOn(existingController, 'abort');
      getProcessFileAbortControllers(context.component).set(file.path, existingController);

      await handleModify(context.component, file);

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should do nothing when the mode does not convert on modify', async () => {
      const context = createContext();
      context.shouldConvertLinksOnModify.mockReturnValue(false);

      await handleModify(context.component, makeTFile('note.md'));

      expect(vi.mocked(parseMetadata)).not.toHaveBeenCalled();
    });

    it('should do nothing while the suggestion container is shown', async () => {
      const context = createContext();
      const suggestionContainer = activeWindow.createDiv();
      suggestionContainer.addClass('suggestion-container');
      activeDocument.body.append(suggestionContainer);
      vi.spyOn(suggestionContainer, 'isShown').mockReturnValue(true);

      await handleModify(context.component, makeTFile('note.md'));

      expect(vi.mocked(parseMetadata)).not.toHaveBeenCalled();
    });

    it('should skip and log ignored files', async () => {
      const context = createContext();
      context.isPathIgnored.mockReturnValue(true);

      await handleModify(context.component, makeTFile('ignored.md'));

      expect(context.consoleDebug).toHaveBeenCalledWith('File ignored.md is ignored in plugin settings, skipping');
      expect(vi.mocked(parseMetadata)).not.toHaveBeenCalled();
    });

    it('should throw when the combined abort signal aborts after reading the cache', async () => {
      const context = createContext();
      const controller = new AbortController();
      controller.abort();
      vi.mocked(abortSignalAny).mockReturnValue(controller.signal);

      await expect(handleModify(context.component, makeTFile('note.md'))).rejects.toThrow();
    });

    it('should return when the note is deleted while its content is being read', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      castTo<DeletedHolder>(file).deleted = true;
      vi.spyOn(context.app.vault, 'cachedRead').mockRejectedValue(new Error('File not found: note.md'));

      await handleModify(context.component, file);

      expect(vi.mocked(parseMetadata)).not.toHaveBeenCalled();
      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should rethrow a read failure for a note that still exists', async () => {
      const context = createContext();
      vi.spyOn(context.app.vault, 'cachedRead').mockRejectedValue(new Error('boom'));

      await expect(handleModify(context.component, makeTFile('note.md'))).rejects.toThrow('boom');
    });

    it('should probe the note own content rather than its cached metadata', async () => {
      const context = createContext();

      await handleModify(context.component, makeTFile('note.md'));

      // The probe reads the note and parses THAT. Asking for the cached metadata instead (`getCacheSafe`)
      // flushes every dirty view of the note on the way, which is what broke issue #40 — so that module
      // mock deliberately does not expose `getCacheSafe` at all, and reintroducing it fails loudly here.
      expect(vi.mocked(parseMetadata)).toHaveBeenCalledWith(context.app, NOTE_CONTENT, expect.anything());
    });

    it('should not convert when all links already match the target style', async () => {
      const context = createContext();
      vi.mocked(getReferences).mockReturnValue([makeLink('converted')]);

      await handleModify(context.component, makeTFile('note.md'));

      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should convert when a link differs from the target style', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getReferences).mockReturnValue([makeLink('[[different]]')]);

      await handleModify(context.component, file);

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
      expect(context.convertLinksInFile.mock.calls[0]?.[0].file).toBe(file);
      expect(getProcessFileAbortControllers(context.component).has(file.path)).toBe(false);
    });

    it('should convert when the only pending change is a body file:// link normalization', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getReferences).mockReturnValue([makeLink('converted')]);
      vi.mocked(parseMetadata).mockResolvedValue(makeCacheWithExternalLinks(true, 'body'));

      await handleModify(context.component, file);

      expect(vi.mocked(parseMetadata)).toHaveBeenCalledWith(context.app, NOTE_CONTENT, {
        shouldParseExternalLinks: true,
        shouldParseFrontmatterExternalLinks: true,
        shouldParseMultiValueFrontmatterExternalLinks: true
      });
      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
      expect(context.convertLinksInFile.mock.calls[0]?.[0].file).toBe(file);
    });

    it('should convert when the only pending change is a multi-link frontmatter file:// link normalization', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getReferences).mockReturnValue([makeLink('converted')]);
      vi.mocked(parseMetadata).mockResolvedValue(makeCacheWithExternalLinks(true, 'multiValueFrontmatter'));

      await handleModify(context.component, file);

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
    });

    it('should convert when the only pending change is a frontmatter file:// link normalization', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getReferences).mockReturnValue([makeLink('converted')]);
      vi.mocked(parseMetadata).mockResolvedValue(makeCacheWithExternalLinks(true, 'frontmatter'));

      await handleModify(context.component, file);

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
    });

    // Issue #44: a link inside a heading is part of the heading's text. `LinkConverter` skips it, so a probe
    // that counted it would re-run a conversion that changes nothing on every save.
    it('should not convert when the only differing link is inside a heading', async () => {
      const context = createContext();
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadataEx>(HEADING_CACHE));
      vi.mocked(getReferences).mockReturnValue([makePositionedLink('[[Target]]', 3, 13)]);

      await handleModify(context.component, makeTFile('note.md'));

      expect(vi.mocked(convertLink)).not.toHaveBeenCalled();
      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should convert when a differing link lies outside every heading', async () => {
      const context = createContext();
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadataEx>(HEADING_CACHE));
      vi.mocked(getReferences).mockReturnValue([makePositionedLink('[[Target]]', 3, 13), makePositionedLink('[[Other]]', 40, 49)]);

      await handleModify(context.component, makeTFile('note.md'));

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
    });

    it('should not convert when the only file:// link is inside a heading', async () => {
      const context = createContext();
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadataEx>({
        ...HEADING_CACHE,
        externalLinks: [{ parseLinkResult: { isFileUrl: true }, position: makePosition(3, 20) }]
      }));

      await handleModify(context.component, makeTFile('note.md'));

      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    // A probe that counted a link the converter skips would re-run a no-op conversion on every save (issue #45).
    it('should not convert when the only differing link has an excluded target', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      const link = makeLink('[[table.base]]');
      const shouldSkipReference = vi.fn<(reference: Reference) => boolean>().mockReturnValue(true);
      vi.mocked(getLinkTargetExclusionPredicate).mockReturnValue(shouldSkipReference);
      vi.mocked(getReferences).mockReturnValue([link]);

      await handleModify(context.component, file);

      expect(vi.mocked(getLinkTargetExclusionPredicate)).toHaveBeenCalledExactlyOnceWith({
        app: context.app,
        settings: context.settings,
        sourceFile: file
      });
      expect(shouldSkipReference).toHaveBeenCalledWith(link);
      expect(vi.mocked(convertLink)).not.toHaveBeenCalled();
      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should convert when a differing link has a target the predicate does not exclude', async () => {
      const context = createContext();
      vi.mocked(getLinkTargetExclusionPredicate).mockReturnValue(vi.fn<(reference: Reference) => boolean>().mockReturnValue(false));
      vi.mocked(getReferences).mockReturnValue([makeLink('[[note]]')]);

      await handleModify(context.component, makeTFile('note.md'));

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
    });

    it('should not convert when the only file:// link has an excluded target', async () => {
      const context = createContext();
      vi.mocked(getLinkTargetExclusionPredicate).mockReturnValue(vi.fn<(reference: Reference) => boolean>().mockReturnValue(true));
      vi.mocked(parseMetadata).mockResolvedValue(makeCacheWithExternalLinks(true, 'body'));

      await handleModify(context.component, makeTFile('note.md'));

      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });
    it('should not convert when the only external link is not a file:// link', async () => {
      const context = createContext();
      vi.mocked(getReferences).mockReturnValue([makeLink('converted')]);
      vi.mocked(parseMetadata).mockResolvedValue(makeCacheWithExternalLinks(false, 'body'));

      await handleModify(context.component, makeTFile('note.md'));

      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should not parse external links or convert a file:// link when normalization is disabled', async () => {
      const context = createContext({}, { shouldNormalizeFileLinks: false });
      const file = makeTFile('note.md');
      vi.mocked(getReferences).mockReturnValue([makeLink('converted')]);
      vi.mocked(parseMetadata).mockResolvedValue(makeCacheWithExternalLinks(true, 'body'));

      await handleModify(context.component, file);

      expect(vi.mocked(parseMetadata)).toHaveBeenCalledWith(context.app, NOTE_CONTENT, {
        shouldParseExternalLinks: false,
        shouldParseFrontmatterExternalLinks: false,
        shouldParseMultiValueFrontmatterExternalLinks: false
      });
      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });
  });

  describe('handleNavigation', () => {
    it('should throw when the plugin abort signal is already aborted', async () => {
      const context = createContext();
      const controller = new AbortController();
      controller.abort();
      castTo<MutableAbortSignalHolder>(context.abortSignalComponent).abortSignal = controller.signal;

      await expect(context.component.handleNavigation(makeTFile('note.md'))).rejects.toThrow();
    });

    it('should do nothing when the mode does not convert on navigation', async () => {
      const context = createContext();
      context.shouldConvertLinksOnNavigation.mockReturnValue(false);

      await context.component.handleNavigation(makeTFile('note.md'));

      expect(vi.mocked(parseMetadata)).not.toHaveBeenCalled();
    });

    it('should convert when the mode converts on navigation', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getReferences).mockReturnValue([makeLink('[[different]]')]);

      await context.component.handleNavigation(file);

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
      expect(context.convertLinksInFile.mock.calls[0]?.[0].file).toBe(file);
    });
  });

  describe('handleSave', () => {
    it('should throw when the plugin abort signal is already aborted', async () => {
      const context = createContext();
      const controller = new AbortController();
      controller.abort();
      castTo<MutableAbortSignalHolder>(context.abortSignalComponent).abortSignal = controller.signal;

      await expect(context.component.handleSave(makeTFile('note.md'))).rejects.toThrow();
    });

    it('should do nothing when the mode does not convert on save', async () => {
      const context = createContext();
      context.shouldConvertLinksOnSave.mockReturnValue(false);

      await context.component.handleSave(makeTFile('note.md'));

      expect(vi.mocked(parseMetadata)).not.toHaveBeenCalled();
    });

    it('should ask whether to convert with isSaveCommand false for a plain save', async () => {
      const context = createContext();

      await context.component.handleSave(makeTFile('note.md'));

      expect(context.shouldConvertLinksOnSave).toHaveBeenCalledWith(false);
    });

    it('should ask whether to convert with isSaveCommand true after markSaveCommand', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      context.component.markSaveCommand(file.path);

      await context.component.handleSave(file);

      expect(context.shouldConvertLinksOnSave).toHaveBeenCalledWith(true);
    });

    it('should consume the save-command flag so a subsequent save is treated as a plain save', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      context.component.markSaveCommand(file.path);

      await context.component.handleSave(file);
      await context.component.handleSave(file);

      expect(context.shouldConvertLinksOnSave).toHaveBeenNthCalledWith(1, true);
      expect(context.shouldConvertLinksOnSave).toHaveBeenNthCalledWith(2, false);
    });

    it('should convert when the mode converts on save', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getReferences).mockReturnValue([makeLink('[[different]]')]);

      await context.component.handleSave(file);

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
      expect(context.convertLinksInFile.mock.calls[0]?.[0].file).toBe(file);
    });
  });

  describe('openLinkText patch', () => {
    it('should call the fallback and skip processing when the source file is missing', async () => {
      const context = createContext({ 'target.md': 'content' });
      loadComponent(context);
      const handleNavigationSpy = vi.spyOn(context.component, 'handleNavigation');

      await context.app.workspace.openLinkText('target', 'missing.md');

      expect(handleNavigationSpy).not.toHaveBeenCalled();
    });

    it('should process the source file after the fallback', async () => {
      const context = createContext({
        'source.md': '',
        'target.md': 'content'
      });
      loadComponent(context);
      const handleNavigationSpy = vi.spyOn(context.component, 'handleNavigation').mockResolvedValue(undefined);

      await context.app.workspace.openLinkText('target', 'source.md');

      const sourceFile = context.app.vault.getFileByPath('source.md');
      expect(handleNavigationSpy).toHaveBeenCalledWith(sourceFile);
    });

    it('should swallow silent errors thrown while processing', async () => {
      const context = createContext({
        'source.md': '',
        'target.md': 'content'
      });
      loadComponent(context);
      vi.spyOn(context.component, 'handleNavigation').mockRejectedValue(new Error('silent'));
      vi.mocked(handleSilentError).mockReturnValue(true);

      await expect(context.app.workspace.openLinkText('target', 'source.md')).resolves.toBeUndefined();
    });

    it('should rethrow non-silent errors thrown while processing', async () => {
      const context = createContext({
        'source.md': '',
        'target.md': 'content'
      });
      loadComponent(context);
      vi.spyOn(context.component, 'handleNavigation').mockRejectedValue(new Error('boom'));
      vi.mocked(handleSilentError).mockReturnValue(false);

      await expect(context.app.workspace.openLinkText('target', 'source.md')).rejects.toThrow('boom');
    });
  });
});
