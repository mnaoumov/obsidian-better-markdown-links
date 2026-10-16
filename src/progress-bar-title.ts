import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';

const PLUGIN_NAME = 'Better Markdown Links';

/**
 * Builds a folder-run progress bar title, prefixed with this plugin's name rendered as code.
 *
 * @param action - What the run is doing, e.g. `Converting links in entire vault...`.
 * @returns The title.
 */
export function buildProgressBarTitle(action: string): DocumentFragment {
  return createFragment((f) => {
    appendCodeBlock(f, PLUGIN_NAME);
    f.appendText(`: ${action}`);
  });
}
