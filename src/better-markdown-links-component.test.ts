import type {
  App,
  CachedMetadata,
  Reference,
  TAbstractFile,
  TFile
} from 'obsidian';
import type { AbortSignalComponent } from 'obsidian-dev-utils/obsidian/components/abort-signal-component';
import type { ConsoleDebugComponent } from 'obsidian-dev-utils/obsidian/components/console-debug-component';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
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

import type { LinkConverter } from './link-converter.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { PluginSettings } from './plugin-settings.ts';

// These factories only stub the return values of pure utility functions the component reads
// (allowed thin `vi.fn()` stubs). The dev-utils base classes (LayoutReadyComponent,
// MonkeyAroundComponent, GenerateMarkdownLinkDefaultParamsComponent) and the plugin's own patch
// Siblings are intentionally NOT mocked, so they run for real against the configured app.
vi.mock('obsidian-dev-utils/abort-controller', () => ({
  abortSignalAny: vi.fn()
}));

// Stub only the return value of the pure utility handleSilentError so the silent/non-silent branches
// Of the openLinkText patch handler can be exercised. convertAsyncToSync keeps its real behavior
// (re-exported via importOriginal) so the real layout-ready/event wiring runs unchanged.
vi.mock('obsidian-dev-utils/async', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/async')>(),
  handleSilentError: vi.fn()
}));

// Stub only the return value of the pure utility convertLink. getGenerateMarkdownLinkDefaultParamsFns
// (same module) keeps its real implementation so the real default-params wiring is observable.
vi.mock('obsidian-dev-utils/obsidian/link', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian-dev-utils/obsidian/link')>(),
  convertLink: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/metadata-cache', () => ({
  getAllLinks: vi.fn(),
  getCacheSafe: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { abortSignalAny } from 'obsidian-dev-utils/abort-controller';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { handleSilentError } from 'obsidian-dev-utils/async';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  convertLink,
  getGenerateMarkdownLinkDefaultParamsFns
} from 'obsidian-dev-utils/obsidian/link';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/metadata-cache';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { BetterMarkdownLinksComponent } from './better-markdown-links-component.ts';

interface CommandsHolder {
  commands: CommandsStub;
}

interface CommandsStub {
  findCommand(commandId: string): unknown;
}

type ConfiguredFiles = NonNullable<Parameters<typeof AppCls.createConfigured__>[0]>['files'];

interface MutableAbortSignalHolder {
  abortSignal: AbortSignal;
}

interface ObsidianDevUtilsStateHolder {
  obsidianDevUtilsState: Partial<Record<string, unknown>>;
}

interface ProcessFileAbortControllersHolder {
  processFileAbortControllers: Map<string, AbortController>;
}

interface TestContext {
  abortSignalComponent: AbortSignalComponent;
  app: App;
  appMock: ReturnType<typeof AppCls.createConfigured__>;
  component: BetterMarkdownLinksComponent;
  consoleDebug: ReturnType<typeof vi.fn>;
  convertLinksInFile: ReturnType<typeof vi.fn<LinkConverter['convertLinksInFile']>>;
  isPathIgnored: ReturnType<typeof vi.fn>;
  settings: PluginSettings;
  shouldConvertLinksOnModify: ReturnType<typeof vi.fn<() => boolean>>;
  shouldConvertLinksOnNavigation: ReturnType<typeof vi.fn<() => boolean>>;
  shouldConvertLinksOnSave: ReturnType<typeof vi.fn<(isSaveCommand: boolean) => boolean>>;
}

function createContext(files: ConfiguredFiles = {}): TestContext {
  const appMock = AppCls.createConfigured__({ files });
  // The configured App mock has no `obsidianDevUtilsState`; the real dev-utils shared-state helpers
  // (used by the real `GenerateMarkdownLinkDefaultParamsComponent`) read it, so seed it like the
  // Sibling-plugin tests do rather than mocking those helpers.
  castTo<ObsidianDevUtilsStateHolder>(appMock).obsidianDevUtilsState = {};
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
    getLinkStyle: vi.fn().mockReturnValue('ObsidianSettingsDefault'),
    isPathIgnored,
    shouldAllowEmptyEmbedAlias: false,
    shouldConvertLinksOnModify,
    shouldConvertLinksOnNavigation,
    shouldConvertLinksOnSave,
    shouldIncludeAttachmentExtensionToEmbedAlias: true,
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

function makeLink(original: string): Reference {
  return castTo<Reference>({ original });
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
  activeDocument.body.innerHTML = '';
  vi.mocked(abortSignalAny).mockImplementation((...signals) => signals[0] ?? new AbortController().signal);
  vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({}));
  vi.mocked(getAllLinks).mockReturnValue([]);
  vi.mocked(convertLink).mockReturnValue('converted');
  vi.mocked(handleSilentError).mockReturnValue(false);
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
      const lastFn = fns.at(-1);
      // `shouldAllowEmptyEmbedAlias` must be exposed under the dev-utils name `isEmptyEmbedAliasAllowed`;
      // Returning the settings object verbatim silently dropped it (the field names differ).
      expect(lastFn?.()).toEqual({
        isEmptyEmbedAliasAllowed: false,
        shouldIncludeAttachmentExtensionToEmbedAlias: true,
        shouldUseAngleBrackets: false,
        shouldUseLeadingDotForRelativePaths: false,
        shouldUseLeadingSlashForAbsolutePaths: true
      });
    });
  });

  describe('handleModify', () => {
    it('should throw when the plugin abort signal is already aborted', async () => {
      const context = createContext();
      const controller = new AbortController();
      controller.abort();
      castTo<MutableAbortSignalHolder>(context.abortSignalComponent).abortSignal = controller.signal;

      await expect(context.component.handleModify(makeTFile('note.md'))).rejects.toThrow();
    });

    it('should ignore non-file abstract files', async () => {
      const context = createContext();

      await context.component.handleModify(makeTFolder('folder'));

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should abort an in-progress conversion for the same file', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      const existingController = new AbortController();
      const abortSpy = vi.spyOn(existingController, 'abort');
      getProcessFileAbortControllers(context.component).set(file.path, existingController);

      await context.component.handleModify(file);

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should do nothing when the mode does not convert on modify', async () => {
      const context = createContext();
      context.shouldConvertLinksOnModify.mockReturnValue(false);

      await context.component.handleModify(makeTFile('note.md'));

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should do nothing while the suggestion container is shown', async () => {
      const context = createContext();
      const suggestionContainer = activeWindow.createDiv();
      suggestionContainer.addClass('suggestion-container');
      activeDocument.body.appendChild(suggestionContainer);
      vi.spyOn(suggestionContainer, 'isShown').mockReturnValue(true);

      await context.component.handleModify(makeTFile('note.md'));

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should skip and log ignored files', async () => {
      const context = createContext();
      context.isPathIgnored.mockReturnValue(true);

      await context.component.handleModify(makeTFile('ignored.md'));

      expect(context.consoleDebug).toHaveBeenCalledWith('File ignored.md is ignored in plugin settings, skipping');
      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should throw when the combined abort signal aborts after reading the cache', async () => {
      const context = createContext();
      const controller = new AbortController();
      controller.abort();
      vi.mocked(abortSignalAny).mockReturnValue(controller.signal);

      await expect(context.component.handleModify(makeTFile('note.md'))).rejects.toThrow();
    });

    it('should return when there is no cache', async () => {
      const context = createContext();
      vi.mocked(getCacheSafe).mockResolvedValue(null);

      await context.component.handleModify(makeTFile('note.md'));

      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should not convert when all links already match the target style', async () => {
      const context = createContext();
      vi.mocked(getAllLinks).mockReturnValue([makeLink('converted')]);

      await context.component.handleModify(makeTFile('note.md'));

      expect(context.convertLinksInFile).not.toHaveBeenCalled();
    });

    it('should convert when a link differs from the target style', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getAllLinks).mockReturnValue([makeLink('[[different]]')]);

      await context.component.handleModify(file);

      expect(context.convertLinksInFile).toHaveBeenCalledOnce();
      expect(context.convertLinksInFile.mock.calls[0]?.[0].file).toBe(file);
      expect(getProcessFileAbortControllers(context.component).has(file.path)).toBe(false);
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

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
    });

    it('should convert when the mode converts on navigation', async () => {
      const context = createContext();
      const file = makeTFile('note.md');
      vi.mocked(getAllLinks).mockReturnValue([makeLink('[[different]]')]);

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

      expect(vi.mocked(getCacheSafe)).not.toHaveBeenCalled();
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
      vi.mocked(getAllLinks).mockReturnValue([makeLink('[[different]]')]);

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
