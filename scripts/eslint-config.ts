import type { Linter } from 'eslint';

import { defineEslintConfigs } from '@mnaoumov/obsidian-dev-toolkit/linters/eslint-config';
import {
  defineConfig,
  globalIgnores
} from 'eslint/config';

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs(context) {
    return defineConfig([
      // A verbatim copy of the provider's hand-written `api.d.ts`, refreshed from its repository rather than edited,
      // so its style is the provider's to keep.
      globalIgnores(['src/rename-delete-handover/advanced-rename-and-delete-handler-api/api.d.ts']),
      {
        rules: {
          'obsidianmd/ui/sentence-case': [
            'error',
            {
              brands: [
                'Backlink Cache',
                'Markdown'
              ]
            }
          ]
        }
      },
      {
        // `evalInObsidian` closures run in the Obsidian renderer, where `window` and `document` always exist, but the
        // rule reads these files' Node test globals, which declare neither. Drop once the shared config exempts them.
        files: ['src/**/*.integration.test.ts'],
        rules: {
          'unicorn/no-optional-chaining-on-undeclared-variable': 'off'
        }
      },
      {
        // Scoped like the toolkit's own in-house block, the only one that loads the `typescript-dev-toolkit` plugin.
        files: context.allFiles(),
        rules: {
          'typescript-dev-toolkit/no-undefined-return-type': 'error'
        }
      }
    ]);
  }
});
