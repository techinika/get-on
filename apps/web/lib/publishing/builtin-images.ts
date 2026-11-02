import { promises as fs } from "node:fs";
import path from "node:path";
import { templateImageById } from "@get-on/templates";
import { usedImageIds, type SourceMedia, type SourcePage } from "./build-input";

function candidates(src: string): string[] {
  const relative = src.replace(/^\/+/, "");
  return [
    path.join(process.cwd(), "public", relative),
    path.join(process.cwd(), "apps", "web", "public", relative),
  ];
}

async function readPublicFile(src: string): Promise<Uint8Array | null> {
  for (const file of candidates(src)) {
    try {
      return new Uint8Array(await fs.readFile(file));
    } catch {
      // Try the next likely root.
    }
  }
  return null;
}

/**
 * Finds the built-in template pictures used by these pages. They are read
 * from the app's public files, so they never need a row in the customer's
 * Pictures library or the project-media bucket.
 */
export async function builtinTemplateImages(
  pages: SourcePage[],
): Promise<{ media: SourceMedia[]; bytes: Map<string, Uint8Array> }> {
  const wanted = usedImageIds(pages);
  const media: SourceMedia[] = [];
  const bytes = new Map<string, Uint8Array>();

  for (const id of wanted) {
    const image = templateImageById(id);
    if (!image) continue;
    const body = await readPublicFile(image.src);
    if (!body) continue;
    bytes.set(id, body);
    media.push({
      id,
      path: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height,
      mime: "image/webp",
    });
  }

  return { media, bytes };
}
