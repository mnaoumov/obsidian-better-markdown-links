import type { TFile } from "obsidian";

export const MARKDOWN_FILE_EXTENSION = "md";

export function isMarkdownFile(file: TFile) {
  return file.extension.toLowerCase() === MARKDOWN_FILE_EXTENSION;
}

export function trimMarkdownExtension(file: TFile): string {
  if (!isMarkdownFile(file)) {
    return file.path;
  }

  return file.path.slice(0, -(MARKDOWN_FILE_EXTENSION.length + 1));
}
