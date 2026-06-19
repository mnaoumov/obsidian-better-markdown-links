import type { App } from 'obsidian';

import { GlobalCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/global-command-handler';

import type { LinkConverter } from '../link-converter.ts';

interface ConvertLinksInEntireVaultCommandHandlerConstructorParams {
  readonly app: App;
  readonly linkConverter: LinkConverter;
}

export class ConvertLinksInEntireVaultCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly linkConverter: LinkConverter;

  public constructor(params: ConvertLinksInEntireVaultCommandHandlerConstructorParams) {
    super({
      icon: 'link',
      id: 'convert-links-in-entire-vault',
      name: 'Convert links in entire vault'
    });

    this.app = params.app;
    this.linkConverter = params.linkConverter;
  }

  protected override async execute(): Promise<void> {
    await this.linkConverter.convertLinksInFolder({
      folder: this.app.vault.getRoot()
    });
  }
}
