import { hashBytes, slugify } from "./hash";
import type { BuiltFile, PublishFont } from "./types";

export type PreparedFont = {
  family: string;
  weight: number;
  style: string;
  fileName: string;
};

export type PrepareFontsResult = {
  shared: Record<string, BuiltFile>;
  fonts: PreparedFont[];
};

/**
 * Copies the fonts of the website into the shared area. The file name holds
 * a short hash of the content, so a changed font gets a new name and the
 * browser keeps the old one in its cache.
 */
export function prepareFonts(fonts: PublishFont[]): PrepareFontsResult {
  const shared: Record<string, BuiltFile> = {};
  const prepared: PreparedFont[] = [];

  for (const font of fonts) {
    if (!font.bytes || font.bytes.byteLength === 0) continue;
    const hash = hashBytes(font.bytes, 8);
    const fileName = `${slugify(font.family)}-${font.weight}-${hash}.woff2`;
    shared[`fonts/${fileName}`] = {
      body: font.bytes,
      contentType: "font/woff2",
      size: font.bytes.byteLength,
    };
    prepared.push({
      family: font.family,
      weight: font.weight,
      style: font.style ?? "normal",
      fileName,
    });
  }

  return { shared, fonts: prepared };
}
