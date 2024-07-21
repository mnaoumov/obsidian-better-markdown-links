export default class BetterMarkdownLinksPluginSettings {
  public automaticallyConvertNewLinks = true;
  public automaticallyUpdateLinksOnRenameOrMove: boolean = true;
  public ignoreIncompatibleObsidianSettings: boolean = false;
  public useAngleBrackets: boolean = true;
  public useLeadingDot: boolean = true;

  public static load(data: unknown): BetterMarkdownLinksPluginSettings {
    return BetterMarkdownLinksPluginSettings.clone(data as BetterMarkdownLinksPluginSettings);
  }

  public static clone(settings?: BetterMarkdownLinksPluginSettings): BetterMarkdownLinksPluginSettings {
    const target = new BetterMarkdownLinksPluginSettings();
    if (settings) {
      for (const key of Object.keys(target) as Array<keyof BetterMarkdownLinksPluginSettings>) {
        if (key in settings && typeof settings[key] === typeof target[key]) {
          target[key] = settings[key];
        }
      }
    }

    return target;
  }
}
