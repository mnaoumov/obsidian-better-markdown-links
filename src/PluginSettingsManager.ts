import type { MaybeReturn } from 'obsidian-dev-utils/Type';

import { PluginSettingsManagerBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsManagerBase';
import { isValidRegExp } from 'obsidian-dev-utils/RegExp';

import type { PluginTypes } from './PluginTypes.ts';

import { PluginSettings } from './PluginSettings.ts';

export class PluginSettingsManager extends PluginSettingsManagerBase<PluginTypes> {
  protected override createDefaultSettings(): PluginSettings {
    return new PluginSettings();
  }

  protected override registerValidators(): void {
    this.registerValidator('includePaths', pathsValidator);
    this.registerValidator('excludePaths', pathsValidator);
  }
}

function pathsValidator(paths: string[]): MaybeReturn<string> {
  for (const path of paths) {
    if (path.startsWith('/') && path.endsWith('/')) {
      const regExp = path.slice(1, -1);
      if (!isValidRegExp(regExp)) {
        return `Invalid regular expression ${path}`;
      }
    }
  }
}
