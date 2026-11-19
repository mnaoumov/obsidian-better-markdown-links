/**
 * @file
 *
 * Integration suite for issue #46: a link inserted by the `[[` autocomplete is written in the configured style.
 *
 * Obsidian's link suggester builds the inserted link itself and never calls `fileManager.generateMarkdownLink`, so
 * before the fix it inserted `[target with space](target%20with%20space.md)` whatever this plugin's settings said. Each
 * scenario types into a real editor with trusted keystrokes, waits for the real suggester to open, accepts its first
 * suggestion with a trusted `Enter`, then types one more character to prove where the cursor was left.
 *
 * It is named `*.desktop.integration.test.ts` so it runs only in the desktop integration project.
 */

import type {
  Editor,
  SettingTab
} from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettings } from '../settings/plugin-settings.ts';

import { LinkStyleMode } from '../settings/link-style-mode.ts';

/**
 * What {@link runPropertiesPanelScenario} reads back once the chosen link is committed.
 */
interface PropertiesPanelScenarioResult {
  /**
   * The links Obsidian indexes from the note's frontmatter.
   */
  readonly frontmatterLinks: string[];

  /**
   * The property's value, as Obsidian parses it from the saved frontmatter.
   */
  readonly value: string;
}

/**
 * Parameters for {@link runAutocompleteScenario}.
 */
interface RunAutocompleteScenarioParams {
  /**
   * The `type` the suggester's first suggestion must have, for the whole query, before `Enter` is pressed (`none` is
   * core's "no note matches" entry, which links to a note that does not exist yet). The suggester computes its
   * suggestions asynchronously, so without it `Enter` can accept a suggestion computed for a prefix of the query.
   */
  readonly expectedFirstSuggestionType?: string;

  /**
   * The plugin's link style mode.
   */
  readonly linkStyleMode: LinkStyleMode;

  /**
   * The text typed after `[[`, before `Enter` accepts the first suggestion.
   */
  readonly query: string;

  /**
   * The `shouldConvertFrontmatterWikilinksToMarkdown` setting; off when absent.
   */
  readonly shouldConvertFrontmatterWikilinksToMarkdown?: boolean;

  /**
   * The note's content, with {@link CURSOR_MARKER} where `[[` is typed; the note is created empty when absent.
   */
  readonly sourceContent?: string;

  /**
   * The note to type into; created empty.
   */
  readonly sourcePath: string;

  /**
   * Obsidian's own `Use [[Wikilinks]]` setting, inverted.
   */
  readonly useMarkdownLinks: boolean;
}

/**
 * Parameters for {@link runPropertiesPanelScenario}.
 */
interface RunPropertiesPanelScenarioParams {
  /**
   * The text typed after `[[`, before `Enter` accepts the first suggestion.
   */
  readonly query: string;

  /**
   * The `shouldConvertFrontmatterWikilinksToMarkdown` setting.
   */
  readonly shouldConvertFrontmatterWikilinksToMarkdown: boolean;

  /**
   * The note to create and open.
   */
  readonly sourcePath: string;
}

/**
 * The parts of a canvas the test drives; `obsidian-typings` declares no canvas internals.
 */
interface TestableCanvas {
  readonly nodes: Map<string, TestableCanvasTextNode>;
  readonly selectOnly: (node: TestableCanvasTextNode) => void;
}

/**
 * The parts of a canvas text card the test drives.
 */
interface TestableCanvasTextNode {
  readonly child: TestableCanvasTextNodeChild;
  readonly isContentMounted: boolean;
  readonly startEditing: () => void;
}

/**
 * The markdown child of a canvas text card.
 */
interface TestableCanvasTextNodeChild {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The test sets the flag a double click on an on-screen card checks.
  editable: boolean;
  readonly editMode?: TestableCanvasTextNodeEditMode;
}

/**
 * The edit mode a canvas text card opens when editing starts.
 */
interface TestableCanvasTextNodeEditMode {
  readonly editor?: Editor;
}

/**
 * A canvas view, exposing its canvas.
 */
interface TestableCanvasView {
  readonly canvas: TestableCanvas;
}

/**
 * The (otherwise protected) settings component exposed for the test, letting it change settings the
 * same way the plugin's own settings UI does.
 */
interface TestableSettingsComponent {
  readonly editAndSave: (settingsEditor: (settings: PluginSettings) => Promise<void> | void) => Promise<void>;
}

/**
 * The plugin's settings tab, exposing its settings component.
 */
interface TestableSettingsTab extends SettingTab {
  readonly pluginSettingsComponent: TestableSettingsComponent;
}

const PLUGIN_ID = 'better-markdown-links';
const TARGET_PATH = 'autocomplete/target with space.md';
const TARGET_CONTENT = '# Section one\n\ntext\n';
const CURSOR_MARKER = 'X';
const CANVAS_NODE_ID = 'card';
const MISSING_NOTE_NAME = 'unwritten chapter';
const MISSING_NOTE_PATH = `autocomplete/${MISSING_NOTE_NAME}.md`;

describe('[[ autocomplete link style (Desktop)', () => {
  beforeAll(async () => {
    await evalInObsidian({
      async callback({ app, targetContent, targetPath }) {
        app.vault.setConfig('newLinkFormat', 'relative');
        app.vault.setConfig('newFileLocation', 'current');

        const existing = app.vault.getAbstractFileByPath(targetPath);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }

        const folderPath = targetPath.split('/').slice(0, -1).join('/');
        if (!app.vault.getAbstractFileByPath(folderPath)) {
          await app.vault.createFolder(folderPath);
        }

        await app.vault.create(targetPath, targetContent);
      },
      input: { targetContent: TARGET_CONTENT, targetPath: TARGET_PATH },
      vaultPath: getTemporaryVault().path
    });
  });

  it('should insert a note link with angle brackets and a leading dot, with the cursor after it', async () => {
    const content = await runAutocompleteScenario({
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      query: 'target with',
      sourcePath: 'autocomplete/note.md',
      useMarkdownLinks: true
    });

    expect(content).toBe(`[target with space](<./target with space.md>)${CURSOR_MARKER}`);
  });

  it('should insert a heading link with angle brackets and no percent-encoding', async () => {
    const content = await runAutocompleteScenario({
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      query: 'target with space#Section',
      sourcePath: 'autocomplete/heading.md',
      useMarkdownLinks: true
    });

    expect(content).toBe(`[Section one](<./target with space.md#Section one>)${CURSOR_MARKER}`);
  });

  it('should insert a markdown link when the plugin forces markdown links over Obsidian wikilinks', async () => {
    const content = await runAutocompleteScenario({
      linkStyleMode: LinkStyleMode.Markdown,
      query: 'target with',
      sourcePath: 'autocomplete/forced.md',
      useMarkdownLinks: false
    });

    expect(content).toBe(`[target with space](<./target with space.md>)${CURSOR_MARKER}`);
  });

  it('should insert a link into a canvas text card, relative to the canvas', async () => {
    // Issue #46 follow-up: the suggester's context carries no file in a canvas text card, and the patch threw on it,
    // so `Enter` inserted nothing.
    const content = await runAutocompleteScenario({
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      query: 'target with',
      sourcePath: 'autocomplete/board.canvas',
      useMarkdownLinks: true
    });

    expect(content).toBe(`[target with space](<./target with space.md>)${CURSOR_MARKER}`);
  });

  it('should keep a link typed as a frontmatter property value a wikilink, so the property still holds a link', async () => {
    // Issue #46 follow-up: the patch rewrote it as `[target with space](<./target with space.md>)`, which YAML reads as
    // a flow sequence, so the property lost its link.
    const content = await runAutocompleteScenario({
      expectedFirstSuggestionType: 'file',
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      query: 'target with',
      sourceContent: `---\nrelated: ${CURSOR_MARKER}\n---\nbody\n`,
      sourcePath: 'autocomplete/frontmatter.md',
      useMarkdownLinks: true
    });

    expect(content).toBe(`---\nrelated: [[./target with space]]${CURSOR_MARKER}\n---\nbody\n`);
  });

  it('should quote a markdown link typed as a frontmatter property value when frontmatter wikilinks are converted', async () => {
    const content = await runAutocompleteScenario({
      expectedFirstSuggestionType: 'file',
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      query: 'target with',
      shouldConvertFrontmatterWikilinksToMarkdown: true,
      sourceContent: `---\nrelated: ${CURSOR_MARKER}\n---\nbody\n`,
      sourcePath: 'autocomplete/frontmatter-markdown.md',
      useMarkdownLinks: true
    });

    expect(content).toBe(`---\nrelated: "[target with space](<./target with space.md>)"${CURSOR_MARKER}\n---\nbody\n`);

    const related = await evalInObsidian({
      async callback({ app, cursorMarker, lib: { waitUntil }, obsidianModule, sourcePath }): Promise<unknown> {
        const file = app.vault.getFileByPath(sourcePath);
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        if (!file || !view) {
          throw new Error(`Missing ${sourcePath}`);
        }

        // The cursor marker after the closing quote is invalid YAML, so it is removed before the note is saved and indexed.
        view.editor.setValue(view.editor.getValue().replace(cursorMarker, ''));
        await view.save();
        await waitUntil({
          message: 'the frontmatter link to be indexed',
          predicate: () => (app.metadataCache.getFileCache(file)?.frontmatterLinks?.length ?? 0) > 0
        });
        return app.metadataCache.getFileCache(file)?.frontmatterLinks?.map((link) => link.link);
      },
      input: { cursorMarker: CURSOR_MARKER, sourcePath: 'autocomplete/frontmatter-markdown.md' },
      vaultPath: getTemporaryVault().path
    });

    expect(related).toEqual(['./target with space.md']);
  });

  it.each([
    [false, '[[./target with space]]', './target with space'],
    [true, '[target with space](<./target with space.md>)', './target with space.md']
  ])(
    'should commit a link chosen in the Properties panel in the configured style (frontmatter wikilinks converted: %s)',
    async (shouldConvertFrontmatterWikilinksToMarkdown, expectedValue, expectedLink) => {
      // Issue #46 follow-up: with Source mode off, the Properties panel's own suggester committed `[[target with space]]`
      // whatever the settings said.
      const result = await runPropertiesPanelScenario({
        query: 'target with',
        shouldConvertFrontmatterWikilinksToMarkdown,
        sourcePath: `autocomplete/properties-${String(shouldConvertFrontmatterWikilinksToMarkdown)}.md`
      });

      expect(result).toEqual({ frontmatterLinks: [expectedLink], value: expectedValue });
    }
  );

  it('should insert a link to a note that does not exist yet as its vault path, which core creates the note from', async () => {
    await evalInObsidian({
      async callback({ app, missingNotePath }): Promise<void> {
        const existing = app.vault.getAbstractFileByPath(missingNotePath);
        if (existing) {
          await app.fileManager.trashFile(existing);
        }
      },
      input: { missingNotePath: MISSING_NOTE_PATH },
      vaultPath: getTemporaryVault().path
    });

    const content = await runAutocompleteScenario({
      expectedFirstSuggestionType: 'none',
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      query: MISSING_NOTE_NAME,
      sourcePath: 'autocomplete/missing.md',
      useMarkdownLinks: true
    });

    // The leading slash is the plugin's `shouldUseLeadingSlashForAbsolutePaths`, on by default.
    expect(content).toBe(`[${MISSING_NOTE_NAME}](</${MISSING_NOTE_PATH}>)${CURSOR_MARKER}`);

    // Follow the inserted link as a click does: core hands the link's URL to `openLinkText`, which creates a missing
    // note from it.
    const createdPath = await evalInObsidian({
      async callback({ app, linkUrl, sourcePath }): Promise<null | string> {
        await app.workspace.openLinkText(linkUrl, sourcePath);
        return app.workspace.getActiveFile()?.path ?? null;
      },
      input: { linkUrl: `/${MISSING_NOTE_PATH}`, sourcePath: 'autocomplete/missing.md' },
      vaultPath: getTemporaryVault().path
    });

    expect(createdPath).toBe(MISSING_NOTE_PATH);
  });
});

/**
 * Applies the settings, types `[[` and the query into a fresh note, accepts the first suggestion with `Enter`, types
 * {@link CURSOR_MARKER}, and returns the editor's content.
 *
 * @param params - See {@link RunAutocompleteScenarioParams}.
 * @returns The editor's content.
 */
async function runAutocompleteScenario(params: RunAutocompleteScenarioParams): Promise<string> {
  return evalInObsidian({
    async callback({
      app,
      canvasNodeId,
      cursorMarker,
      expectedFirstSuggestionType,
      lib: {
        pressKey,
        typeIntoEditor,
        waitUntil
      },
      linkStyleMode,
      obsidianModule,
      pluginId,
      query,
      shouldConvertFrontmatterWikilinksToMarkdown,
      sourceContent,
      sourcePath,
      useMarkdownLinks
    }): Promise<string> {
      async function getMarkdownEditor(): Promise<Editor> {
        await waitUntil({
          message: 'the markdown editor to open',
          predicate: () => app.workspace.getActiveViewOfType(obsidianModule.MarkdownView)?.file?.path === sourcePath
        });

        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        if (!view) {
          throw new Error('The markdown editor closed again');
        }

        return view.editor;
      }

      async function startEditingCanvasTextCard(): Promise<Editor> {
        function getCanvas(): TestableCanvas | undefined {
          return (app.workspace.getActiveViewOfType(obsidianModule.FileView) as null | Partial<TestableCanvasView>)?.canvas;
        }

        await waitUntil({
          message: 'the canvas to show its text card',
          predicate: () => getCanvas()?.nodes.get(canvasNodeId)?.isContentMounted ?? false
        });

        const canvas = getCanvas();
        const node = canvas?.nodes.get(canvasNodeId);
        if (!canvas || !node) {
          throw new Error('The canvas closed again');
        }

        // A card is editable once the canvas has rendered it on screen; the harness window is off-screen, so the flag a
        // double click checks is set here, then the card is opened for editing the way that double click opens it.
        node.child.editable = true;
        canvas.selectOnly(node);
        // Editing opens the card's editor synchronously.
        node.startEditing();

        const cardEditor = node.child.editMode?.editor;
        if (!cardEditor) {
          throw new Error('The text card editor closed again');
        }

        cardEditor.focus();
        return cardEditor;
      }

      app.vault.setConfig('useMarkdownLinks', useMarkdownLinks);

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkStyleMode = linkStyleMode;
        settings.shouldUseAngleBrackets = true;
        settings.shouldUseLeadingDotForRelativePaths = true;
        settings.shouldConvertFrontmatterWikilinksToMarkdown = shouldConvertFrontmatterWikilinksToMarkdown;
      });

      const existing = app.vault.getAbstractFileByPath(sourcePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }

      const isCanvas = sourcePath.endsWith('.canvas');
      const fileContent = isCanvas
        ? JSON.stringify({ edges: [], nodes: [{ height: 200, id: canvasNodeId, text: '', type: 'text', width: 400, x: 0, y: 0 }] })
        : (sourceContent ?? '').replace(cursorMarker, '');
      const sourceFile = await app.vault.create(sourcePath, fileContent);
      // A frontmatter property is typed into as YAML, which Live Preview shows as a properties widget instead.
      await app.workspace.getLeaf(false).openFile(sourceFile, sourceContent === null ? {} : { state: { mode: 'source', source: true } });

      const editor = isCanvas ? await startEditingCanvasTextCard() : await getMarkdownEditor();
      if (sourceContent === null) {
        await typeIntoEditor({ editor, text: `[[${query}` });
      } else {
        // `typeIntoEditor` types at the end of the note, so the keys are pressed at the marked position instead.
        editor.focus();
        editor.setCursor(editor.offsetToPos(sourceContent.indexOf(cursorMarker)));
        for (const character of `[[${query}`) {
          await pressKey({ key: character });
        }
      }

      await waitUntil({
        message: 'the link suggester to offer a suggestion',
        predicate: () => {
          const currentSuggest = app.workspace.editorSuggest.currentSuggest;
          const values = currentSuggest?.suggestions.values ?? [];
          const isOpenWithSuggestions = (currentSuggest?.isOpen ?? false) && values.length > 0;
          const firstSuggestionType = (values[0] as Partial<Record<'type', string>> | undefined)?.type;
          const isExpectedFirstSuggestion = expectedFirstSuggestionType === null
            || (firstSuggestionType === expectedFirstSuggestionType && currentSuggest?.context?.query === query);
          return isOpenWithSuggestions && isExpectedFirstSuggestion;
        }
      });

      await pressKey({ key: 'Enter' });
      await waitUntil({
        message: 'the link suggester to close',
        predicate: () => !app.workspace.editorSuggest.currentSuggest
      });
      await pressKey({ key: cursorMarker });
      await waitUntil({
        message: 'the cursor marker to be typed',
        predicate: () => editor.getValue().includes(cursorMarker)
      });

      return editor.getValue();
    },
    input: {
      canvasNodeId: CANVAS_NODE_ID,
      cursorMarker: CURSOR_MARKER,
      expectedFirstSuggestionType: params.expectedFirstSuggestionType ?? null,
      linkStyleMode: params.linkStyleMode,
      pluginId: PLUGIN_ID,
      query: params.query,
      shouldConvertFrontmatterWikilinksToMarkdown: params.shouldConvertFrontmatterWikilinksToMarkdown ?? false,
      sourceContent: params.sourceContent ?? null,
      sourcePath: params.sourcePath,
      useMarkdownLinks: params.useMarkdownLinks
    },
    vaultPath: getTemporaryVault().path
  });
}

/**
 * Opens a fresh note with a `text` property in Live Preview, types `[[` and the query into that property's value in the
 * Properties panel, accepts the first suggestion with `Enter`, and returns the value committed and the frontmatter
 * links Obsidian indexes from it.
 *
 * @param params - See {@link RunPropertiesPanelScenarioParams}.
 * @returns The committed value and the indexed frontmatter links.
 */
async function runPropertiesPanelScenario(params: RunPropertiesPanelScenarioParams): Promise<PropertiesPanelScenarioResult> {
  return evalInObsidian({
    async callback({
      app,
      lib: {
        pressKey,
        waitUntil
      },
      linkStyleMode,
      obsidianModule,
      pluginId,
      propertyKey,
      query,
      shouldConvertFrontmatterWikilinksToMarkdown,
      sourcePath
    }): Promise<PropertiesPanelScenarioResult> {
      app.vault.setConfig('useMarkdownLinks', true);

      const settingTab = app.setting.pluginTabs.find((tab) => tab.id === pluginId);
      if (!settingTab) {
        throw new Error(`Settings tab not found for plugin: ${pluginId}`);
      }

      await (settingTab as TestableSettingsTab).pluginSettingsComponent.editAndSave((settings) => {
        settings.linkStyleMode = linkStyleMode;
        settings.shouldUseAngleBrackets = true;
        settings.shouldUseLeadingDotForRelativePaths = true;
        settings.shouldConvertFrontmatterWikilinksToMarkdown = shouldConvertFrontmatterWikilinksToMarkdown;
      });

      const existing = app.vault.getAbstractFileByPath(sourcePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }

      const sourceFile = await app.vault.create(sourcePath, `---\n${propertyKey}: placeholder\n---\nbody\n`);
      await app.workspace.getLeaf(false).openFile(sourceFile, { state: { mode: 'source', source: false } });

      function getValueInput(): HTMLElement | null {
        const view = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
        return view?.file?.path === sourcePath
          ? view.containerEl.querySelector<HTMLElement>(`.metadata-property[data-property-key="${CSS.escape(propertyKey)}"] .metadata-input-longtext`)
          : null;
      }

      await waitUntil({
        message: 'the Properties panel to show the property',
        predicate: () => getValueInput() !== null
      });

      const valueInput = getValueInput();
      if (!valueInput) {
        throw new Error('The Properties panel closed again');
      }

      valueInput.focus();
      valueInput.win.getSelection()?.selectAllChildren(valueInput);
      for (const character of `[[${query}`) {
        await pressKey({ key: character });
      }

      function getFirstSuggestionText(): string {
        return activeDocument.body.querySelector(':scope .suggestion-container.mod-property-value .suggestion-item')?.textContent ?? '';
      }

      await waitUntil({
        message: 'the property value suggester to offer the target',
        predicate: () => getFirstSuggestionText().includes('target with space') && valueInput.textContent === `[[${query}`
      });

      await pressKey({ key: 'Enter' });

      await waitUntil({
        message: 'the chosen link to be committed and indexed',
        predicate: () => (app.metadataCache.getFileCache(sourceFile)?.frontmatterLinks?.length ?? 0) > 0
      });

      const cache = app.metadataCache.getFileCache(sourceFile);
      return {
        frontmatterLinks: cache?.frontmatterLinks?.map((link) => link.link) ?? [],
        value: String(cache?.frontmatter?.[propertyKey])
      };
    },
    input: {
      linkStyleMode: LinkStyleMode.ObsidianSettingsDefault,
      pluginId: PLUGIN_ID,
      propertyKey: 'related',
      query: params.query,
      shouldConvertFrontmatterWikilinksToMarkdown: params.shouldConvertFrontmatterWikilinksToMarkdown,
      sourcePath: params.sourcePath
    },
    vaultPath: getTemporaryVault().path
  });
}
