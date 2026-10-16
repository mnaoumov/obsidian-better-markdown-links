import { castTo } from 'obsidian-dev-utils/object-utils';
import {
  App,
  TFile
} from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type {
  BetterMarkdownLinksApiSchema,
  BetterMarkdownLinksApiSchemaResult
} from '../api-contract.ts';
import type { BetterMarkdownLinksApi } from '../api.d.ts';

import { BETTER_MARKDOWN_LINKS_API_CONTRACT } from '../api-contract.ts';

interface MethodCases {
  readonly input: PayloadCase;
  readonly output: PayloadCase;
}

type MethodName = keyof BetterMarkdownLinksApi;

interface PayloadCase {
  readonly invalid: readonly unknown[];
  readonly valid: readonly unknown[];
}

const file = TFile.create__(castTo(App.createConfigured__().vault), 'target.md').asOriginalType2__();

const MINIMAL_OPTIONS = { sourcePathOrFile: 'source.md', targetPathOrFile: 'target.md' };

const FULL_OPTIONS = {
  alias: 'Alias',
  isEmbed: true,
  isEmptyEmbedAliasAllowed: false,
  isNonExistingFileAllowed: true,
  isSingleSubpathAllowed: false,
  linkPathStyle: 'RelativePathToTheSource',
  linkStyle: 'Markdown',
  originalLink: '[[target]]',
  shouldEscapeAlias: true,
  shouldIncludeAttachmentExtensionToEmbedAlias: false,
  shouldUseAngleBrackets: true,
  shouldUseLeadingDotForRelativePaths: true,
  shouldUseLeadingSlashForAbsolutePaths: false,
  sourcePathOrFile: file,
  subpath: '#Heading',
  targetPathOrFile: file
};

const OPTIONS: PayloadCase = {
  invalid: [
    [],
    [null],
    [[]],
    ['target.md'],
    [{ sourcePathOrFile: 'source.md' }],
    [{ targetPathOrFile: 'target.md' }],
    [{ ...MINIMAL_OPTIONS, sourcePathOrFile: 1 }],
    [{ ...MINIMAL_OPTIONS, targetPathOrFile: { path: 'target.md' } }],
    [{ ...MINIMAL_OPTIONS, alias: 1 }],
    [{ ...MINIMAL_OPTIONS, alias: undefined }],
    [{ ...MINIMAL_OPTIONS, isEmbed: 'true' }],
    [{ ...MINIMAL_OPTIONS, linkPathStyle: 'Relative' }],
    [{ ...MINIMAL_OPTIONS, linkStyle: 'markdown' }],
    [MINIMAL_OPTIONS, 'extra'],
    MINIMAL_OPTIONS
  ],
  valid: [[MINIMAL_OPTIONS], [FULL_OPTIONS], [{ ...MINIMAL_OPTIONS, unknownOption: 1 }]]
};

const LINK: PayloadCase = { invalid: [null, undefined, 1, ['[[target]]']], valid: ['', '[target](<target.md>)'] };

const CASES: Record<MethodName, MethodCases> = {
  generateMarkdownLinkExtended: { input: OPTIONS, output: LINK }
};

const METHOD_NAMES: readonly MethodName[] = ['generateMarkdownLinkExtended'];

describe('BETTER_MARKDOWN_LINKS_API_CONTRACT', () => {
  it('should have one entry per method of the API, each with both schemas', () => {
    expect(Object.keys(BETTER_MARKDOWN_LINKS_API_CONTRACT).sort()).toEqual([...METHOD_NAMES].sort());
    for (const methodName of METHOD_NAMES) {
      const methodContract = BETTER_MARKDOWN_LINKS_API_CONTRACT[methodName];
      for (const schema of [methodContract.input, methodContract.output]) {
        expect(schema['~standard']).toMatchObject({ vendor: 'better-markdown-links', version: 1 });
      }
    }
  });

  it('should accept every valid payload and refuse every invalid one', () => {
    for (const methodName of METHOD_NAMES) {
      for (const half of ['input', 'output'] as const) {
        const schema: BetterMarkdownLinksApiSchema<unknown> = BETTER_MARKDOWN_LINKS_API_CONTRACT[methodName][half];
        const { invalid, valid } = CASES[methodName][half];
        for (const [index, value] of valid.entries()) {
          expect(validate(schema, value), `${methodName} ${half} should accept valid case ${String(index)}`).toEqual({ value });
        }

        for (const [index, value] of invalid.entries()) {
          expect(validate(schema, value).issues, `${methodName} ${half} should refuse invalid case ${String(index)}`).not.toHaveLength(0);
        }
      }
    }
  });

  it('should name the failing argument and what it expected', () => {
    expect(validate(BETTER_MARKDOWN_LINKS_API_CONTRACT.generateMarkdownLinkExtended.input, [{ sourcePathOrFile: 'source.md' }])).toEqual({
      issues: [{ message: 'Expected the options of the link to generate, with a sourcePathOrFile and a targetPathOrFile.', path: [0] }]
    });
    expect(validate(BETTER_MARKDOWN_LINKS_API_CONTRACT.generateMarkdownLinkExtended.input, MINIMAL_OPTIONS)).toEqual({
      issues: [{ message: 'Expected an argument list.' }]
    });
    expect(validate(BETTER_MARKDOWN_LINKS_API_CONTRACT.generateMarkdownLinkExtended.input, [MINIMAL_OPTIONS, MINIMAL_OPTIONS])).toEqual({
      issues: [{ message: 'Expected at most 1 argument(s), got 2.' }]
    });
    expect(validate(BETTER_MARKDOWN_LINKS_API_CONTRACT.generateMarkdownLinkExtended.output, null)).toEqual({
      issues: [{ message: 'Expected the markdown of a link.' }]
    });
  });
});

function validate(schema: BetterMarkdownLinksApiSchema<unknown>, value: unknown): BetterMarkdownLinksApiSchemaResult<unknown> {
  return schema['~standard'].validate(value);
}
