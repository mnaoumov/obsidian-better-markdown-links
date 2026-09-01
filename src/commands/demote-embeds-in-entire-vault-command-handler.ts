import type { App } from 'obsidian';

import { GlobalCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/global-command-handler';

import type { EmbedDemoter } from '../embed-demoter.ts';

interface DemoteEmbedsInEntireVaultCommandHandlerConstructorParams {
  readonly app: App;
  readonly embedDemoter: EmbedDemoter;
}

export class DemoteEmbedsInEntireVaultCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly embedDemoter: EmbedDemoter;

  public constructor(params: DemoteEmbedsInEntireVaultCommandHandlerConstructorParams) {
    super({
      icon: 'link',
      id: 'demote-embeds-to-links-in-entire-vault',
      name: 'Demote embeds to links in entire vault'
    });

    this.app = params.app;
    this.embedDemoter = params.embedDemoter;
  }

  protected override async execute(): Promise<void> {
    await this.embedDemoter.demoteEmbedsInFolder({
      folder: this.app.vault.getRoot()
    });
  }
}
