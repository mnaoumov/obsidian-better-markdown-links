# Plugin API

`Better Markdown Links` publishes an API through the [`@mnaoumov/obsidian-lib`](https://www.npmjs.com/package/@mnaoumov/obsidian-lib) plugin registry, under the plugin id `better-markdown-links` at contract version **1.0.0**. Its one method, `generateMarkdownLinkExtended()`, takes the full set of options this plugin generates links with. It is there for a plugin that wants to write the same readable, unambiguous links without re-implementing them.

## Types

The types are in [`api.d.ts`](../api.d.ts) at the root of this repository. Copy that file into your own plugin: it imports from `obsidian` and nothing else, so it costs you no dependency on this one.

## Contract

Beside `api.d.ts`, [`api-contract.ts`](../api-contract.ts) holds the API's contract, `BETTER_MARKDOWN_LINKS_API_CONTRACT`: for every method, a schema over its arguments and a schema over what it returns. It is the constant this plugin publishes with the API, so copy it next to `api.d.ts` and pass it as the `contract`, and both sides check the same definition.

Its schemas are [Standard Schema](https://standardschema.dev) objects built with [`@mnaoumov/typescript-lib/api-contract`](https://www.npmjs.com/package/@mnaoumov/typescript-lib), which carries the generic half (the contract types, the schema builders and the guard builders), and its path-or-file guard comes from [`@mnaoumov/obsidian-lib`](https://www.npmjs.com/package/@mnaoumov/obsidian-lib). So copying it means adding both packages (`npm install @mnaoumov/typescript-lib @mnaoumov/obsidian-lib`, typescript-lib `1.5.0` or later). Apart from those two, the file imports only `obsidian` and `./api.d.ts`.

It is not named `api.ts`, because TypeScript would read `api.d.ts` as that file's own declarations.

## Usage

```ts
import { watchPluginApi } from '@mnaoumov/obsidian-lib/plugin/plugin-api';

import type { BetterMarkdownLinksApi } from './api.d.ts';

import { BETTER_MARKDOWN_LINKS_API_CONTRACT } from './api-contract.ts';

const ref = watchPluginApi<BetterMarkdownLinksApi>({
  apiVersionRange: '^1',
  app: this.app,
  component: this,
  contract: BETTER_MARKDOWN_LINKS_API_CONTRACT,
  pluginId: 'better-markdown-links'
});

const link = ref.value?.generateMarkdownLinkExtended({ sourcePathOrFile, targetPathOrFile, shouldUseAngleBrackets: true })
  ?? this.app.fileManager.generateMarkdownLink(targetFile, sourcePath);
```

`ref.value` is `null` while this plugin is not loaded, so the fallback above keeps working without it.

## Versioning

The contract version does not follow the plugin version: ask for `'^1'`, and every plugin release that changes nothing you depend on keeps working. An addition to the API is a minor bump of the contract; a removal or a changed meaning is a major one.

## The patched `generateMarkdownLink()`

While this plugin is enabled, [`app.fileManager.generateMarkdownLink()`](https://docs.obsidian.md/Reference/TypeScript+API/FileManager/generateMarkdownLink) itself is still patched, with its built-in signature, to write links the way this plugin does.

## Moving over from `extended()`

**Before 6.0.0** the extended function was a member hung off that call, `app.fileManager.generateMarkdownLink.extended()`. 6.0.0 removed that member. `generateMarkdownLinkExtended()` takes exactly the options `extended()` took, so moving over only changes how you find the function.
