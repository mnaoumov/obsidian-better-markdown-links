import { CommandInvocationBase } from 'obsidian-dev-utils/obsidian/Commands/CommandBase';
import { NonEditorCommandBase } from 'obsidian-dev-utils/obsidian/Commands/NonEditorCommandBase';

import type { Plugin } from '../Plugin.ts';

import { convertLinksInFolder } from '../LinkConverter.ts';

class ConvertLinksInEntireVaultCommandInvocation extends CommandInvocationBase<Plugin> {
  protected override async execute(): Promise<void> {
    await super.execute();
    await convertLinksInFolder(this.plugin, this.plugin.app.vault.getRoot(), this.plugin.abortSignal);
  }
}

export class ConvertLinksInEntireVaultCommand extends NonEditorCommandBase<Plugin> {
  public constructor(plugin: Plugin) {
    super({
      icon: 'link',
      id: 'convert-links-in-entire-vault',
      name: 'Convert links in entire vault',
      plugin
    });
  }

  protected override createCommandInvocation(): CommandInvocationBase<Plugin> {
    return new ConvertLinksInEntireVaultCommandInvocation(this.plugin);
  }
}
