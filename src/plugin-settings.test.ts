import {
  describe,
  expect,
  it
} from 'vitest';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettings', () => {
  describe('constructor', () => {
    it('should set default values', () => {
      const settings = new PluginSettings();

      expect(settings.linkConversionMode).toBe(LinkConversionMode.OnSaveCommand);
      expect(settings.shouldAllowEmptyEmbedAlias).toBe(true);
      expect(settings.shouldAutomaticallyUpdateLinksOnRenameOrMove).toBe(true);
      expect(settings.shouldIncludeAttachmentExtensionToEmbedAlias).toBe(false);
      expect(settings.shouldPreserveExistingLinkStyle).toBe(false);
      expect(settings.shouldUseAngleBrackets).toBe(true);
      expect(settings.shouldUseLeadingDotForRelativePaths).toBe(true);
      expect(settings.shouldUseLeadingSlashForAbsolutePaths).toBe(true);
    });

    it('should set default exclude paths for excalidraw and tldraw', () => {
      const settings = new PluginSettings();

      expect(settings.excludePaths).toEqual(['/.+\\.excalidraw\\.md$/', '/.+\\.tldraw\\.md$/']);
    });

    it('should have empty include paths by default', () => {
      const settings = new PluginSettings();

      expect(settings.includePaths).toEqual([]);
    });
  });

  describe('excludePaths', () => {
    it('should get and set exclude paths', () => {
      const settings = new PluginSettings();
      const newPaths = ['/custom-exclude/'];

      settings.excludePaths = newPaths;

      expect(settings.excludePaths).toEqual(newPaths);
    });
  });

  describe('includePaths', () => {
    it('should get and set include paths', () => {
      const settings = new PluginSettings();
      const newPaths = ['/custom-include/'];

      settings.includePaths = newPaths;

      expect(settings.includePaths).toEqual(newPaths);
    });
  });

  describe('getLinkStyle', () => {
    it('should return PreserveExisting when isExistingLink is true and shouldPreserveExistingLinkStyle is true', () => {
      const settings = new PluginSettings();
      settings.shouldPreserveExistingLinkStyle = true;

      const result = settings.getLinkStyle(true);

      expect(result).toBe('PreserveExisting');
    });

    it('should return ObsidianSettingsDefault when isExistingLink is true but shouldPreserveExistingLinkStyle is false', () => {
      const settings = new PluginSettings();
      settings.shouldPreserveExistingLinkStyle = false;

      const result = settings.getLinkStyle(true);

      expect(result).toBe('ObsidianSettingsDefault');
    });

    it('should return ObsidianSettingsDefault when isExistingLink is false regardless of shouldPreserveExistingLinkStyle', () => {
      const settings = new PluginSettings();
      settings.shouldPreserveExistingLinkStyle = true;

      const result = settings.getLinkStyle(false);

      expect(result).toBe('ObsidianSettingsDefault');
    });
  });

  describe('isPathIgnored', () => {
    it('should not ignore paths when exclude paths are empty and include paths are empty', () => {
      const settings = new PluginSettings();
      settings.excludePaths = [];

      expect(settings.isPathIgnored('some/path.md')).toBe(false);
    });

    it('should ignore paths matching exclude regex patterns', () => {
      const settings = new PluginSettings();

      expect(settings.isPathIgnored('drawings/test.excalidraw.md')).toBe(true);
      expect(settings.isPathIgnored('drawings/test.tldraw.md')).toBe(true);
    });

    it('should not ignore paths that do not match exclude patterns', () => {
      const settings = new PluginSettings();

      expect(settings.isPathIgnored('notes/regular.md')).toBe(false);
    });
  });

  describe('shouldConvertLinksOnModify', () => {
    it('should only convert on modify in the OnEveryModification mode', () => {
      const settings = new PluginSettings();

      settings.linkConversionMode = LinkConversionMode.OnExplicitCommand;
      expect(settings.shouldConvertLinksOnModify()).toBe(false);
      settings.linkConversionMode = LinkConversionMode.OnSaveCommand;
      expect(settings.shouldConvertLinksOnModify()).toBe(false);
      settings.linkConversionMode = LinkConversionMode.OnAutoSave;
      expect(settings.shouldConvertLinksOnModify()).toBe(false);
      settings.linkConversionMode = LinkConversionMode.OnEveryModification;
      expect(settings.shouldConvertLinksOnModify()).toBe(true);
    });
  });

  describe('shouldConvertLinksOnNavigation', () => {
    it('should convert on navigation in every mode except OnExplicitCommand', () => {
      const settings = new PluginSettings();

      settings.linkConversionMode = LinkConversionMode.OnExplicitCommand;
      expect(settings.shouldConvertLinksOnNavigation()).toBe(false);
      settings.linkConversionMode = LinkConversionMode.OnSaveCommand;
      expect(settings.shouldConvertLinksOnNavigation()).toBe(true);
      settings.linkConversionMode = LinkConversionMode.OnAutoSave;
      expect(settings.shouldConvertLinksOnNavigation()).toBe(true);
      settings.linkConversionMode = LinkConversionMode.OnEveryModification;
      expect(settings.shouldConvertLinksOnNavigation()).toBe(true);
    });
  });

  describe('shouldConvertLinksOnSave', () => {
    it('should never convert on save in the OnExplicitCommand mode', () => {
      const settings = new PluginSettings();
      settings.linkConversionMode = LinkConversionMode.OnExplicitCommand;

      expect(settings.shouldConvertLinksOnSave(false)).toBe(false);
      expect(settings.shouldConvertLinksOnSave(true)).toBe(false);
    });

    it('should convert on save in the OnSaveCommand mode only for a save command', () => {
      const settings = new PluginSettings();
      settings.linkConversionMode = LinkConversionMode.OnSaveCommand;

      expect(settings.shouldConvertLinksOnSave(false)).toBe(false);
      expect(settings.shouldConvertLinksOnSave(true)).toBe(true);
    });

    it('should convert on any save in the OnAutoSave mode', () => {
      const settings = new PluginSettings();
      settings.linkConversionMode = LinkConversionMode.OnAutoSave;

      expect(settings.shouldConvertLinksOnSave(false)).toBe(true);
      expect(settings.shouldConvertLinksOnSave(true)).toBe(true);
    });

    it('should not convert on save in the OnEveryModification mode since the modify handler covers it', () => {
      const settings = new PluginSettings();
      settings.linkConversionMode = LinkConversionMode.OnEveryModification;

      expect(settings.shouldConvertLinksOnSave(false)).toBe(false);
      expect(settings.shouldConvertLinksOnSave(true)).toBe(false);
    });
  });
});
