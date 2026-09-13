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
  captureDeviceScreenshot,
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  raiseSoftKeyboard,
  readPngDimensions,
  resolveEmulatorDeviceId,
  withSoftKeyboardEnabled
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

/**
 * The AVD the frames are taken on, matched by name.
 *
 * Never the first device `adb devices` lists: a physical phone is routinely plugged into the same
 * machine, and the shared AVD the cross-platform suites drive is a different size.
 */
const AVD_NAME = 'obsidian_screenshots';

/**
 * Obsidian's command palette input, read off this suite's own palette helper rather than assumed: the
 * palette renders `.prompt input`, which is not the `.prompt-input` a suggester renders.
 */
const PALETTE_INPUT_SELECTOR = '.prompt input';

/**
 * The button that turns down the companion-plugin suggestion — see
 * {@link declineCompanionPluginSuggestion}.
 *
 * The label comes from the shared library's own translations, so it is quoted here rather than
 * constructed.
 */
const SUGGESTION_DECLINE_LABEL = 'Not now';

/**
 * The `aria-label` on the close button the shared library appends to a notice that requires an explicit
 * close. The button carries an icon rather than text, so the label is the only thing to match on.
 */
const SUGGESTION_CLOSE_ARIA_LABEL = 'Close';

let deviceId = '';

beforeAll(async () => {
  deviceId = await resolveEmulatorDeviceId({ avdName: AVD_NAME });

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

  await declineCompanionPluginSuggestion();
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
    await shootWithSoftKeyboard(3, 'Convert one note, one folder, or the whole vault');
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
 * Dismisses the companion-plugin suggestion, so it is not in the frames.
 *
 * On load the plugin offers to install Advanced Rename and Delete Handler, through a notice carrying
 * `Install and enable` / `Not now` and a close button. The temp vault holds only this plugin, so the
 * offer always fires — and the notice sat across the top of every frame, covering the first palette row
 * in the very shot whose subject IS that list.
 *
 * **Two clicks, and both are needed.** `Not now` records the decline so the offer does not return, but
 * it deliberately does not take the notice off screen: the suggestion is shown with
 * `shouldHideOnClick: false`, so only the close button removes it. Clicking `Not now` alone was tried
 * first and timed out waiting for a notice that was never going to leave.
 *
 * @returns A {@link Promise} that resolves once the suggestion is off screen.
 */
async function declineCompanionPluginSuggestion(): Promise<void> {
  await evalInObsidian({
    async callback({ closeLabel, declineLabel, lib: { clickElement, waitUntil } }) {
      const NOTICE_TIMEOUT_IN_MILLISECONDS = 15_000;

      // Nothing to dismiss is a perfectly good state: the suggestion is skipped once the setting records
      // That it was declined, and that setting outlives a reload.
      const declineButton = findNoticeButton(declineLabel, null);
      if (declineButton) {
        await clickElement({ element: declineButton });
      }

      const closeButton = findNoticeButton(null, closeLabel);
      if (closeButton) {
        await clickElement({ element: closeButton });
      }

      // Waits for THIS notice to go rather than for the notice area to empty, so an unrelated notice
      // Cannot hold the wait open.
      await waitUntil({
        message: 'the suggestion notice to close',
        predicate: () => !findNoticeButton(declineLabel, null),
        timeoutInMilliseconds: NOTICE_TIMEOUT_IN_MILLISECONDS
      });

      function findNoticeButton(text: null | string, ariaLabel: null | string): HTMLElement | null {
        const button = [...document.querySelectorAll('.notice button')].find((candidate) =>
          (text === null || candidate.textContent === text)
          && (ariaLabel === null || candidate.getAttribute('aria-label') === ariaLabel)
        );

        return button instanceof HTMLElement ? button : null;
      }
    },
    input: { closeLabel: SUGGESTION_CLOSE_ARIA_LABEL, declineLabel: SUGGESTION_DECLINE_LABEL },
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

  await writeFrame(index, caption, captured);
}

/**
 * Raises the soft keyboard, captures the DEVICE, and writes the frame.
 *
 * For a shot whose subject is a focused field. `captureObsidianScreenshot` cannot show a keyboard: it
 * drives Appium in the WebView context, so it photographs the page, and the IME is a system window that
 * is not part of the page — which left such a frame as a field over a large empty band, with the caption
 * band landing on the field and clipping the typed text.
 *
 * Two things are needed and both belong to the harness rather than here: the AVD is built with a hardware
 * keyboard attached, so Android suppresses the on-screen one until `withSoftKeyboardEnabled` lifts that
 * and puts the setting back exactly — including putting back a setting that had never been written, which
 * takes a delete rather than a write; and a WebView will not ask for an IME on programmatic focus alone,
 * so `raiseSoftKeyboard` lands a real touch on the field and then proves geometrically that it lifted,
 * because nothing in the page reports the keyboard.
 *
 * The trade, which applies only to the shots that switch: a device capture is **not** byte-reproducible,
 * because the status-bar clock and the battery indicator are in it. A shot with no focused field keeps
 * {@link shoot} and stays reproducible — a real phone shows no keyboard there either, so raising one
 * would make that frame less true rather than more.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shootWithSoftKeyboard(index: number, caption: string): Promise<void> {
  const captured = await withSoftKeyboardEnabled({
    async callback() {
      await raiseSoftKeyboard({
        deviceId,
        inputSelector: PALETTE_INPUT_SELECTOR,
        vaultPath: vaultPath()
      });

      return await captureDeviceScreenshot({ deviceId });
    },
    deviceId
  });

  await writeFrame(index, caption, captured);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}

/**
 * Asserts the frame is the store size, captions it, and writes it out.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 * @param captured - The raw PNG, from either capture route.
 */
async function writeFrame(index: number, caption: string, captured: Uint8Array): Promise<void> {
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
