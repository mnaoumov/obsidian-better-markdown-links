import type { Linter } from 'eslint';

import { defineEslintConfigs } from '@mnaoumov/obsidian-dev-toolkit/linters/eslint-config';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs() {
    return defineConfig([
      // A verbatim copy of the provider's hand-written `api.d.ts`, refreshed from its repository rather than edited,
      // so its style is the provider's to keep.
      globalIgnores(['src/rename-delete-handover/advanced-rename-and-delete-handler-api/api.d.ts']),
      {
        rules: {
          'obsidianmd/ui/sentence-case': [
            'error',
            {
              brands: ['Backlink Cache']
            }
          ]
        }
      }
    ]);
  }
});
