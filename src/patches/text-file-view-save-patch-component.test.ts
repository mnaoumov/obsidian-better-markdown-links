import type { TFile } from 'obsidian';

import { waitForAllAsyncOperations } from 'obsidian-dev-utils/async';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  TextFileView,
  TFile as TFileCls
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { BetterMarkdownLinksComponent } from '../better-markdown-links-component.ts';

import { TextFileViewSavePatchComponent } from './text-file-view-save-patch-component.ts';

interface CreateComponentResult {
  readonly component: TextFileViewSavePatchComponent;
  readonly handleSave: ReturnType<typeof vi.fn>;
}

interface SaveThis {
  file: null | TFile;
}

const loadedComponents: TextFileViewSavePatchComponent[] = [];

function createComponent(): CreateComponentResult {
  const handleSave = vi.fn<BetterMarkdownLinksComponent['handleSave']>().mockResolvedValue(undefined);
  const betterMarkdownLinksComponent = strictProxy<BetterMarkdownLinksComponent>({ handleSave });
  const component = new TextFileViewSavePatchComponent({ betterMarkdownLinksComponent });
  loadedComponents.push(component);
  component.load();
  return {
    component,
    handleSave
  };
}

function invokeSave(saveThis: SaveThis): Promise<void> {
  return castTo<(this: SaveThis) => Promise<void>>(TextFileView.prototype.save).call(saveThis);
}

function makeTFile(path: string): TFile {
  const realVault = strictProxy<Parameters<typeof TFileCls.create__>[0]>({});
  return castTo<TFile>(TFileCls.create__(realVault, path));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  while (loadedComponents.length > 0) {
    loadedComponents.pop()?.unload();
  }
});

describe('TextFileViewSavePatchComponent', () => {
  it('should forward the saved file to handleSave after the original save', async () => {
    const { handleSave } = createComponent();
    const file = makeTFile('note.md');

    await invokeSave({ file });
    await waitForAllAsyncOperations();

    expect(handleSave).toHaveBeenCalledExactlyOnceWith(file);
  });

  it('should not call handleSave when the view has no file', async () => {
    const { handleSave } = createComponent();

    await invokeSave({ file: null });
    await waitForAllAsyncOperations();

    expect(handleSave).not.toHaveBeenCalled();
  });
});
