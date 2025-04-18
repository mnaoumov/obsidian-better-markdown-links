import { escapeRegExp } from 'obsidian-dev-utils/RegExp';

const ALWAYS_MATCH_REG_EXP = /(?:)/;
const NEVER_MATCH_REG_EXP = /$./;

export class PluginSettings {
  public allowEmptyEmbedAlias = true;
  public automaticallyConvertNewLinks = true;
  public automaticallyUpdateLinksOnRenameOrMove = true;
  public ignoreIncompatibleObsidianSettings = false;

  public includeAttachmentExtensionToEmbedAlias = false;
  public useAngleBrackets = true;
  public useLeadingDot = true;
  public get excludePaths(): string[] {
    return this._excludePaths;
  }

  public set excludePaths(value: string[]) {
    this._excludePaths = value.filter(Boolean);
    this._excludePathsRegExp = makeRegExp(this._excludePaths, NEVER_MATCH_REG_EXP);
  }

  public get includePaths(): string[] {
    return this._includePaths;
  }

  public set includePaths(value: string[]) {
    this._includePaths = value.filter(Boolean);
    this._includePathsRegExp = makeRegExp(this._includePaths, ALWAYS_MATCH_REG_EXP);
  }

  private _excludePaths: string[] = [];
  private _excludePathsRegExp = NEVER_MATCH_REG_EXP;
  private _includePaths: string[] = [];
  private _includePathsRegExp = ALWAYS_MATCH_REG_EXP;

  public isPathIgnored(path: string): boolean {
    return !this._includePathsRegExp.test(path) || this._excludePathsRegExp.test(path);
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
