import { defineObsidianPluginVitestConfig } from 'obsidian-dev-utils/script-utils/test-runners/vitest-config';

export const config = defineObsidianPluginVitestConfig({
  editContext(context) {
    // Ambient declaration files carry no statements to cover, and counting them cannot reach 100%.
    context.coverageExclude.push('src/**/*.d.ts');
  }
});
