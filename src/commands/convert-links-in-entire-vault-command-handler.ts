import { GlobalCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/global-command-handler';

import type { Plugin } from '../plugin.ts';

import { convertLinksInFolder } from '../link-converter.ts';

export class ConvertLinksInEntireVaultCommandHandler extends GlobalCommandHandler {
  public constructor(private readonly plugin: Plugin) {
    super({
      icon: 'link',
      id: 'convert-links-in-entire-vault',
      name: 'Convert links in entire vault'
    });
  }

  protected override async execute(): Promise<void> {
    await convertLinksInFolder(this.plugin, this.plugin.app.vault.getRoot(), this.plugin.abortSignal);
  }
}
