import type { App } from 'obsidian';

import { Notice } from 'obsidian';
import { configureCommunityPlugin } from 'obsidian-dev-utils/obsidian/community-plugins';

const PLUGIN_ID = 'better-markdown-links';
const MESSY_FOLDER_PATH = 'Materials/03 Convert links';
const MESSY_NOTE_PATH = `${MESSY_FOLDER_PATH}/Messy links.md`;
const EMBEDDED_FOLDER_PATH = 'Materials/04 Demote embeds';
const EMBEDDED_NOTE_PATH = `${EMBEDDED_FOLDER_PATH}/Embedded links.md`;
const UNRESOLVED_FOLDER_PATH = 'Materials/03 Convert links';
const UNRESOLVED_NOTE_PATH = `${UNRESOLVED_FOLDER_PATH}/Unresolved links.md`;
const ALIASED_NOTE_PATH = `${UNRESOLVED_FOLDER_PATH}/Aliased note.md`;
const WIKILINK_NOTE_PATH = `${MESSY_FOLDER_PATH}/Wikilinks.md`;

interface DemoSettingsPatch {
  linkConversionMode?: string;
  linkStyleMode?: string;
  shouldAppendFileNameWhenDemotingEmbeds?: boolean;
  shouldCreateMissingNotes?: boolean;
  shouldNormalizeFileLinks?: boolean;
  shouldResolveLinksViaAliases?: boolean;
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
  await openDemoNote(app, MESSY_FOLDER_PATH, MESSY_NOTE_PATH, MESSY_CONTENT);
  new Notice('Messy links note ready. Now convert it.');
}

/**
 * Writes (or rewrites) one demo note and opens it, creating its folder if needed. Every "create a note
 * to try this against" button goes through here, so pressing one twice restores the note rather than
 * accumulating edits.
 */
async function openDemoNote(app: App, folderPath: string, notePath: string, content: string): Promise<void> {
  if (!app.vault.getFolderByPath(folderPath)) {
    await app.vault.createFolder(folderPath);
  }

  const existing = app.vault.getFileByPath(notePath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(notePath, content);
  }

  const note = app.vault.getFileByPath(notePath);
  if (note) {
    await app.workspace.getLeaf(false).openFile(note);
  }
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

// A note whose every link is an embed - one attachment-style embed of a real note, one with an alias,
// one plain. Demoting turns each `![...]` into `[...]`, leaving the target and the alias untouched.
const EMBEDDED_CONTENT = [
  '# Embedded links',
  '',
  'Every link below is an embed. Run **Better Markdown Links: Demote embeds to links in current file**',
  'and watch each `!` disappear while the target and the alias stay put.',
  '',
  '- A plain embed: ![](<../01 Angle bracket links/A folder with spaces/Note with spaces.md>)',
  '- An embed with an alias: ![The simple one](<../02 Relative links/Targets/Simple note.md>)',
  '- A wikilink embed: ![[../02 Relative links/Targets/Nested folder/Deep note.md]]',
  ''
].join('\n');

// The note `[[The Simple One]]` is meant to find. Its file name is nothing like the link text - only its
// `aliases` frontmatter connects the two, which is exactly what the alias lookup is for.
const ALIASED_CONTENT = [
  '---',
  'aliases:',
  '  - The Simple One',
  '---',
  '',
  '# Aliased note',
  '',
  'This note answers to `The Simple One`, but its file name says otherwise.',
  ''
].join('\n');

// A note whose wikilinks Obsidian cannot resolve: the first names an ALIAS rather than a file name, the
// Second names a note that does not exist at all. Converting with the two resolution settings on turns
// The first into a link to the aliased note and creates a note for the second.
const UNRESOLVED_CONTENT = [
  '# Unresolved links',
  '',
  'Neither wikilink below resolves as written. Convert this note with **Should resolve links via',
  'aliases** and **Should create missing notes** enabled and watch both find a real target.',
  '',
  '- Named by its alias, not its file name: [[The Simple One]]',
  '- A note that does not exist yet: [[A brand new note]]',
  ''
].join('\n');

/**
 * Creates (or restores) a note whose links are all embeds and opens it.
 *
 * Manual equivalent: create a note and write some `![...]` embeds in it.
 */
export async function openEmbeddedNote(app: App): Promise<void> {
  await openDemoNote(app, EMBEDDED_FOLDER_PATH, EMBEDDED_NOTE_PATH, EMBEDDED_CONTENT);
  new Notice('Embedded links note ready. Now demote them.');
}

/**
 * Creates (or restores) a note whose wikilinks do not resolve, plus the aliased note one of them is
 * meant to find, and opens the unresolved note.
 *
 * Manual equivalent: write `[[Some Alias]]` pointing at a note whose `aliases` frontmatter carries that
 * alias, and `[[A brand new note]]` pointing at nothing.
 */
export async function openUnresolvedNote(app: App): Promise<void> {
  await openDemoNote(app, UNRESOLVED_FOLDER_PATH, ALIASED_NOTE_PATH, ALIASED_CONTENT);
  await openDemoNote(app, UNRESOLVED_FOLDER_PATH, UNRESOLVED_NOTE_PATH, UNRESOLVED_CONTENT);
  new Notice('Unresolved links note ready. Now convert it.');
}

/**
 * Runs the demote command on the active note.
 *
 * Manual equivalent: **Better Markdown Links: Demote embeds to links in current file** in the Command
 * Palette.
 */
export function demoteEmbedsInCurrentFile(app: App): void {
  app.commands.executeCommandById(`${PLUGIN_ID}:demote-embeds-to-links-in-current-file`);
}

// A note of plain wikilinks. Nothing here is malformed - with Obsidian's `Use [[Wikilinks]]` setting on,
// This is what Obsidian itself writes, and what a plain convert run leaves untouched. It is the note the
// Force-Markdown surfaces exist for.
const WIKILINK_CONTENT = [
  '# Wikilinks',
  '',
  'Every link below is a wikilink. A plain **Convert links** run leaves them alone while Obsidian\'s',
  '`Use [[Wikilinks]]` setting is on; forcing the Markdown style rewrites them.',
  '',
  '- A link: [[../01 Angle bracket links/A folder with spaces/Note with spaces]]',
  '- A link with an alias: [[../02 Relative links/Targets/Simple note|The simple one]]',
  '- An embed: ![[../02 Relative links/Targets/Nested folder/Deep note]]',
  ''
].join('\n');

/**
 * Creates (or restores) a note of plain wikilinks and opens it.
 *
 * Manual equivalent: create a note and write some `[[wikilinks]]` in it.
 */
export async function openWikilinkNote(app: App): Promise<void> {
  await openDemoNote(app, MESSY_FOLDER_PATH, WIKILINK_NOTE_PATH, WIKILINK_CONTENT);
  new Notice('Wikilinks note ready. Now force the Markdown style.');
}

/**
 * Runs the force-Markdown convert command on the active note.
 *
 * Manual equivalent: **Better Markdown Links: Convert links to Markdown in current file** in the Command
 * Palette.
 */
export function convertLinksToMarkdownInCurrentFile(app: App): void {
  app.commands.executeCommandById(`${PLUGIN_ID}:convert-links-to-markdown-in-current-file`);
}
