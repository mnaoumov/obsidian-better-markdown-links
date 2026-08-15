/**
 * @file
 *
 * Produces the mobile screenshots the community-store listing needs
 * (T461-P21), driving a staged note in Obsidian Mobile on a real Android
 * emulator and writing images/screenshots/screenshot-mobile-N.png.
 *
 * The mobile counterpart of the desktop capture suite, showing the same three
 * frames. See the desktop suite for why every shot is source mode and why the
 * vault is put into markdown-link mode first.
 *
 * There is no mobile equivalent of the desktop viewport override, so the AVD is
 * built at exactly 900x1600 — see [[T461-P21]] for its one-time provisioning.
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

/**
 * App, reduced to the font-size applier that obsidian-typings does not declare.
 * Setting baseFontSize alone changes nothing on screen.
 */
interface FontSizeApp {
  updateFontSize(this: void): void;
}

/**
 * `App`, reduced to the inline-title toggle that `obsidian-typings` does not
 * declare. Setting the config alone changes nothing on screen.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay(this: void): void;
}

const PLUGIN_ID = 'better-markdown-links';
const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

/**
 * Base font size for the mobile shots. Below the 16px default, so a link path
 * fits one line on a 450dp screen instead of wrapping mid-path.
 */
const MOBILE_FONT_SIZE_IN_PIXELS = 13;

const SUBJECT_NOTE_PATH = 'Screenshots/Reading list.md';

/**
 * The notes the staged links point at. Their names carry spaces on purpose —
 * that is what makes Obsidian percent-escape them.
 */
const SPACED_NOTE_PATH = 'Screenshots/Notes with spaces/first chapter.md';
const PLAIN_NOTE_PATH = 'Screenshots/Second chapter.md';

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

beforeAll(async () => {
  const vault = getTemporaryVault();

  vault.populate({
    [PLAIN_NOTE_PATH]: '# Second chapter\n',
    [SPACED_NOTE_PATH]: '# First chapter\n',
    [SUBJECT_NOTE_PATH]: buildSubjectNote()
  });
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, fontSizeInPixels, lib: { waitUntil }, subjectNotePath }) {
      // A closure runs inside ONE Appium execute/sync call, which WebDriver caps
      // Around 30s, so every wait in here stays comfortably under it.
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      app.changeTheme('obsidian');

      await waitUntil({
        message: 'the staged notes to appear in the vault',
        predicate: () => Boolean(app.vault.getFileByPath(subjectNotePath)),
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      app.vault.setConfig('baseFontSize', fontSizeInPixels);
      const fontApp: unknown = app;
      (fontApp as FontSizeApp).updateFontSize();

      // The plugin generates links in the style the VAULT is set to. Left at
      // Obsidian's default the convert command produced wikilinks, and the
      // Angle-bracket form the shots are about never appeared. Relative paths
      // Are what makes the leading './' meaningful.
      app.vault.setConfig('useMarkdownLinks', true);
      app.vault.setConfig('newLinkFormat', 'relative');

      app.vault.setConfig('showInlineTitle', false);
      const inlineTitleApp: unknown = app;
      (inlineTitleApp as InlineTitleApp).updateInlineTitleDisplay();

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { fontSizeInPixels: MOBILE_FONT_SIZE_IN_PIXELS, subjectNotePath: SUBJECT_NOTE_PATH },
    vaultPath: vaultPath()
  });
});

describe('mobile store screenshots', () => {
  it('1 - the links Obsidian writes', async () => {
    const content = await openNote();
    // The point of the shot: these are the spellings the plugin replaces.
    expect(content).toContain('%20');
    await shoot(1, 'What you get by default: percent-escapes and bare paths');
  });

  it('2 - the same links, converted', async () => {
    const content = await convertLinksInNote();
    expect(content).not.toContain('%20');
    // Angle brackets around the path with spaces, and an explicit `./` so the
    // Link means the same thing outside Obsidian as it does inside.
    expect(content).toContain('(<./');
    await shoot(2, 'Readable paths, angle brackets, an explicit ./');
  });

  it('3 - converting what is already there', async () => {
    await openCommandPalette('Convert links');
    await shoot(3, 'Convert one note, one folder, or the whole vault');
  });
});

/**
 * Builds the staged note.
 *
 * Every link is written the way Obsidian itself writes it, so shot 1 is a fair
 * picture of the problem rather than a caricature: percent-escaped spaces, a
 * relative path with no leading `./`, and a wikilink for good measure.
 *
 * @returns The note's Markdown.
 */
function buildSubjectNote(): string {
  return '# Reading list\n\n'
    + '- [first chapter](Notes%20with%20spaces/first%20chapter.md)\n'
    + '- [second chapter](Second%20chapter.md)\n'
    + '- [[Second chapter|the one after that]]\n';
}

/**
 * Runs the convert command on the open note.
 *
 * @returns The note's content afterwards.
 */
async function convertLinksInNote(): Promise<string> {
  return await evalInObsidian({
    async callback({ app, lib: { waitUntil }, pluginId, subjectNotePath }) {
      const CONVERT_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      // Let the previous shot's capture settle: the device-metrics override it
      // Sets and clears disturbs anything driven too soon afterwards.
      const file = app.vault.getFileByPath(subjectNotePath);
      if (!file) {
        throw new Error(`Note is missing from the vault: ${subjectNotePath}`);
      }

      const wasExecuted = app.commands.executeCommandById(`${pluginId}:convert-links-in-current-file`);
      if (!wasExecuted) {
        throw new Error('The convert command did not run.');
      }

      await waitUntil({
        message: 'the links to be rewritten',
        predicate: async () => {
          const content = await app.vault.read(file);
          return content.includes('(<');
        },
        timeoutInMilliseconds: CONVERT_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return await app.vault.read(file);
    },
    input: { pluginId: PLUGIN_ID, subjectNotePath: SUBJECT_NOTE_PATH },
    vaultPath: vaultPath()
  });
}

/**
 * Opens the command palette and filters it to this plugin's convert commands.
 *
 * @param query - What to type into the palette.
 */
async function openCommandPalette(query: string): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, query: text }) {
      const PALETTE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 900;

      app.commands.executeCommandById('command-palette:open');

      await waitUntil({
        message: 'the command palette to open',
        predicate: () => Boolean(document.querySelector('.prompt input')),
        timeoutInMilliseconds: PALETTE_TIMEOUT_IN_MILLISECONDS
      });

      const input = document.querySelector('.prompt input');
      if (!(input instanceof HTMLInputElement)) {
        throw new TypeError('The command palette has no input.');
      }

      input.value = text;
      // The palette filters from its own `input` handler, so setting `value`
      // Alone would leave every command in the vault on screen.
      input.dispatchEvent(new Event('input'));

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { query },
    vaultPath: vaultPath()
  });
}

/**
 * Opens the staged note in source mode.
 *
 * @returns The note's content.
 */
async function openNote(): Promise<string> {
  return await evalInObsidian({
    async callback({ app, lib: { waitUntil }, subjectNotePath }) {
      const RENDER_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1200;

      const file = app.vault.getFileByPath(subjectNotePath);
      if (!file) {
        throw new Error(`Note is missing from the vault: ${subjectNotePath}`);
      }

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(file);
      // `source: true` forces RAW Markdown, which is where the link spelling is
      // Visible at all.
      await leaf.setViewState({
        state: { file: subjectNotePath, mode: 'source', source: true },
        type: 'markdown'
      });

      await waitUntil({
        message: 'the editor to render',
        predicate: () => Boolean(document.querySelector('.cm-content')),
        timeoutInMilliseconds: RENDER_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return await app.vault.read(file);
    },
    input: { subjectNotePath: SUBJECT_NOTE_PATH },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the window, captions it, and writes it as
 * `images/screenshots/screenshot-mobile-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const captured = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  // The AVD is 900x1600, so the device frame IS the store size. Asserting it
  // Here is what keeps that true: run this against any other AVD and it fails
  // Loudly instead of quietly shipping an off-spec image.
  expect(readPngDimensions(captured)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  const labeled = await labelScreenshot(captured, { text: caption });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), labeled);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
