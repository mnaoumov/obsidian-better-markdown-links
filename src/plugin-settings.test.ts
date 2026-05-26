import {
  describe,
  expect,
  it
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettings', () => {
  describe('constructor', () => {
    it('should set default values', () => {
      const settings = new PluginSettings();

      expect(settings.shouldAllowEmptyEmbedAlias).toBe(true);
      expect(settings.shouldAutomaticallyConvertNewLinks).toBe(true);
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
});
