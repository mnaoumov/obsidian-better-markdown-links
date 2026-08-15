import type { App } from 'obsidian';

import { Notice } from 'obsidian';
import { configureCommunityPlugin } from 'obsidian-dev-utils/obsidian/community-plugins';

const PLUGIN_ID = 'better-markdown-links';
const MESSY_FOLDER_PATH = 'Materials/03 Convert links';
const MESSY_NOTE_PATH = `${MESSY_FOLDER_PATH}/Messy links.md`;

interface DemoSettingsPatch {
  linkConversionMode?: string;
  shouldNormalizeFileLinks?: boolean;
  shouldPreserveExistingLinkStyle?: boolean;
  shouldUseAngleBrackets?: boolean;
  shouldUseLeadingDotForRelativePaths?: boolean;
  shouldUseLeadingSlashForAbsolutePaths?: boolean;
}

// Deliberately written the way Obsidian and older notes write them: percent-encoded spaces, no angle
// Brackets, no leading `./`, and a percent-encoded `file://` URL.
// The convert command's whole job is to turn these into the readable forms the other notes describe.
// The backslash half of `file://` normalization is shown in the note's own prose rather than here: an
// Encoded Windows separator glues the drive letter onto the next path segment, and the spellchecker
// Reads the result as a misspelt word.
const MESSY_CONTENT = [
  '# Messy links',
  '',
  'Links written the way they look before conversion. Run **Better Markdown Links: Convert links in',
  'current file** on this note and watch each one snap into the readable form.',
  '',
  '- Percent-encoded spaces: [Note with spaces](../01%20Angle%20bracket%20links/A%20folder%20with%20spaces/Note%20with%20spaces.md)',
  '- No leading dot on a relative path: [Simple note](../02%20Relative%20links/Targets/Simple%20note.md)',
  '- A deeper one: [Deep note](../02%20Relative%20links/Targets/Nested%20folder/Deep%20note.md)',
  '- A percent-encoded file URL: [todo](file:///C:/notes/todo%20list.md)',
  ''
].join('\n');

/**
 * Creates (or restores) a note full of unconverted links and opens it.
 *
 * The walkthrough used to say "add a messy link by hand", which meant knowing what a messy link looks
 * like before you had seen the plugin fix one.
 *
 * Manual equivalent: create a note and paste in some percent-encoded, dot-less markdown links.
 */
export async function openMessyNote(app: App): Promise<void> {
  if (!app.vault.getFolderByPath(MESSY_FOLDER_PATH)) {
    await app.vault.createFolder(MESSY_FOLDER_PATH);
  }

  const existing = app.vault.getFileByPath(MESSY_NOTE_PATH);
  if (existing) {
    await app.vault.modify(existing, MESSY_CONTENT);
  } else {
    await app.vault.create(MESSY_NOTE_PATH, MESSY_CONTENT);
  }

  const note = app.vault.getFileByPath(MESSY_NOTE_PATH);
  if (note) {
    await app.workspace.getLeaf(false).openFile(note);
  }

  new Notice('Messy links note ready. Now convert it.');
}

/**
 * Runs the convert command on the active note.
 *
 * Manual equivalent: **Better Markdown Links: Convert links in current file** in the Command Palette.
 */
export function convertLinksInCurrentFile(app: App): void {
  app.commands.executeCommandById(`${PLUGIN_ID}:convert-links-in-current-file`);
}

/**
 * Applies a settings patch, live, through the plugin's own settings component. Re-open the messy note
 * and convert again to see the difference.
 *
 * Manual equivalent: change the same option in **Settings -> Community plugins -> Better Markdown
 * Links**.
 */
export async function changeSettings(app: App, patch: DemoSettingsPatch): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: patch });
  new Notice('Applied. Reset the messy note and convert again to compare.');
}
