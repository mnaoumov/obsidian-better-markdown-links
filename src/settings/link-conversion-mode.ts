/**
 * When links are automatically converted to the configured style. Each value is cumulative: every
 * higher level also triggers on the triggers of the levels below it.
 */
export enum LinkConversionMode {
  /**
   * Additionally on Obsidian's implicit auto-save (which also covers the `Save current file` command).
   */
  OnAutoSave = 'OnAutoSave',

  /**
   * Additionally on every file modification, including changes made outside Obsidian.
   */
  OnEveryModification = 'OnEveryModification',

  /**
   * Only when a manual convert command is invoked. No automatic conversion happens.
   */
  OnExplicitCommand = 'OnExplicitCommand',

  /**
   * Additionally when the `Save current file` command runs (usually bound to `Ctrl + S`).
   */
  OnSaveCommand = 'OnSaveCommand'
}
