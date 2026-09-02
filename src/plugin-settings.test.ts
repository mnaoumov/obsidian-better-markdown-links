import {
  describe,
  expect,
  it
} from 'vitest';

import { LinkConversionMode } from './link-conversion-mode.ts';
import { LinkStyleMode } from './link-style-mode.ts';
import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettings', () => {
  describe('constructor', () => {
    it('should set default values', () => {
      const settings = new PluginSettings();

      expect(settings.isAdvancedRenameAndDeleteHandlerSuggestionDeclined).toBe(false);
      expect(settings.linkConversionMode).toBe(LinkConversionMode.OnSaveCommand);
      expect(settings.linkStyleMode).toBe(LinkStyleMode.ObsidianSettingsDefault);
      expect(settings.shouldAllowEmptyEmbedAlias).toBe(true);
      expect(settings.shouldIncludeAttachmentExtensionToEmbedAlias).toBe(false);
      expect(settings.shouldNormalizeFileLinks).toBe(true);
      expect(settings.shouldUseAngleBrackets).toBe(true);
      expect(settings.shouldUseLeadingDotForRelativePaths).toBe(true);
      expect(settings.shouldUseLeadingSlashForAbsolutePaths).toBe(true);
    });

    // A fresh install has nothing to hand to Advanced Rename and Delete Handler, and must never be told it
    // Has a migration waiting — only a legacy converter puts a value here.
    it('should have no pending rename-handling migration', () => {
      const settings = new PluginSettings();

      expect(settings.proposedShouldHandleRenames).toBeNull();
    });

    it('should set default exclude paths for excalidraw and tldraw', () => {
      const settings = new PluginSettings();

      expect(settings.excludePaths).toEqual([String.raw`/.+\.excalidraw\.md$/`, String.raw`/.+\.tldraw\.md$/`]);
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

  describe('getGeneratedLinkStyle', () => {
    it('should force Markdown only in the Markdown mode', () => {
      const settings = new PluginSettings();

      settings.linkStyleMode = LinkStyleMode.Markdown;
      expect(settings.getGeneratedLinkStyle()).toBe('Markdown');
    });

    // The other two modes ARE what obsidian-dev-utils does with no style at all, and saying so out loud
    // Would beat the `originalLink` inference embed demotion depends on.
    it('should say nothing in the other modes, leaving the inference alone', () => {
      const settings = new PluginSettings();

      settings.linkStyleMode = LinkStyleMode.PreserveExisting;
      expect(settings.getGeneratedLinkStyle()).toBeUndefined();
      settings.linkStyleMode = LinkStyleMode.ObsidianSettingsDefault;
      expect(settings.getGeneratedLinkStyle()).toBeUndefined();
    });
  });

  describe('getLinkStyle', () => {
    it('should map each mode to its link style', () => {
      const settings = new PluginSettings();

      settings.linkStyleMode = LinkStyleMode.Markdown;
      expect(settings.getLinkStyle()).toBe('Markdown');
      settings.linkStyleMode = LinkStyleMode.PreserveExisting;
      expect(settings.getLinkStyle()).toBe('PreserveExisting');
      settings.linkStyleMode = LinkStyleMode.ObsidianSettingsDefault;
      expect(settings.getLinkStyle()).toBe('ObsidianSettingsDefault');
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
