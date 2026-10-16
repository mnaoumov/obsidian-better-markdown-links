import {
  describe,
  expect,
  it
} from 'vitest';

import { buildProgressBarTitle } from './progress-bar-title.ts';

describe('buildProgressBarTitle', () => {
  it('should render the plugin name as code ahead of the action', () => {
    const title = buildProgressBarTitle('Converting links in entire vault...');

    expect(title.querySelector('code')?.textContent).toBe('Better Markdown Links');
    expect(title.textContent).toBe('Better Markdown Links: Converting links in entire vault...');
  });
});
