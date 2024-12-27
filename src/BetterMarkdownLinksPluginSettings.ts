import { PluginSettingsBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsBase';
import { escapeRegExp } from 'obsidian-dev-utils/RegExp';

const ALWAYS_MATCH_REG_EXP = /(?:)/;
const NEVER_MATCH_REG_EXP = /$./;

export class BetterMarkdownLinksPluginSettings extends PluginSettingsBase {
  public allowEmptyEmbedAlias = true;
  public automaticallyConvertNewLinks = true;
  public automaticallyUpdateLinksOnRenameOrMove = true;
  public ignoreIncompatibleObsidianSettings = false;

  public includeAttachmentExtensionToEmbedAlias = false;
  public useAngleBrackets = true;
  public useLeadingDot = true;
  public get excludePaths(): string[] {
    return this.#excludePaths;
  }

  public set excludePaths(value: string[]) {
    this.#excludePaths = value.filter(Boolean);
    this.#excludePathsRegExp = makeRegExp(this.#excludePaths, NEVER_MATCH_REG_EXP);
  }

  public get includePaths(): string[] {
    return this.#includePaths;
  }

  public set includePaths(value: string[]) {
    this.#includePaths = value.filter(Boolean);
    this.#includePathsRegExp = makeRegExp(this.#includePaths, ALWAYS_MATCH_REG_EXP);
  }

  #excludePaths: string[] = [];
  #excludePathsRegExp = NEVER_MATCH_REG_EXP;
  #includePaths: string[] = [];
  #includePathsRegExp = ALWAYS_MATCH_REG_EXP;

  public constructor(data: unknown) {
    super();
    this.init(data);
  }

  public isPathIgnored(path: string): boolean {
    return !this.#includePathsRegExp.test(path) || this.#excludePathsRegExp.test(path);
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      excludePaths: this.excludePaths,
      includePaths: this.includePaths
    };
  }
}

function makeRegExp(paths: string[], defaultRegExp: RegExp): RegExp {
  if (paths.length === 0) {
    return defaultRegExp;
  }

  const regExpStrCombined = paths.map((path) => {
    if (path.startsWith('/') && path.endsWith('/')) {
      return path.slice(1, -1);
    }
    return `^${escapeRegExp(path)}`;
  })
    .map((regExpStr) => `(${regExpStr})`)
    .join('|');
  return new RegExp(regExpStrCombined);
}
