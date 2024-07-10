export default class BetterMarkdownLinksPluginSettings {
  public useLeadingDot: boolean = true;
  public useAngleBrackets: boolean = true;
  public ignoreIncompatibleObsidianSettings: boolean = false;

  public static load(value: unknown): BetterMarkdownLinksPluginSettings {
    if (!value) {
      return new BetterMarkdownLinksPluginSettings();
    }

    return value as BetterMarkdownLinksPluginSettings;
  }

  public static clone(settings?: BetterMarkdownLinksPluginSettings): BetterMarkdownLinksPluginSettings {
    return Object.assign(new BetterMarkdownLinksPluginSettings(), settings);
  }
}
