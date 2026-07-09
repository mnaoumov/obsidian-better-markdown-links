import type { App } from 'obsidian';

import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { BetterMarkdownLinksComponent } from '../better-markdown-links-component.ts';

const SAVE_FILE_COMMAND_ID = 'editor:save-file';

interface EditorSaveFileCommandPatchComponentConstructorParams {
  readonly app: App;
  readonly betterMarkdownLinksComponent: BetterMarkdownLinksComponent;
}

/**
 * Patches the `editor:save-file` command so a save initiated by that command (usually `Ctrl + S`) can be
 * distinguished from Obsidian's implicit auto-save. The command's `checkCallback` runs before the
 * underlying `TextFileView.save()`, so it tags the active file; the save patch then consumes that tag.
 */
export class EditorSaveFileCommandPatchComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly betterMarkdownLinksComponent: BetterMarkdownLinksComponent;

  public constructor(params: EditorSaveFileCommandPatchComponentConstructorParams) {
    super();
    this.app = params.app;
    this.betterMarkdownLinksComponent = params.betterMarkdownLinksComponent;
  }

  public override onload(): void {
    const command = this.app.commands.findCommand(SAVE_FILE_COMMAND_ID);
    if (!command) {
      return;
    }

    this.registerMethodPatch({
      methodName: 'checkCallback',
      obj: command,
      patchHandler: ({ fallback, originalArgs: [checking] }) => {
        if (!checking) {
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile) {
            this.betterMarkdownLinksComponent.markSaveCommand(activeFile.path);
          }
        }

        return fallback();
      }
    });
  }
}
