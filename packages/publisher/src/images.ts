import sharp from "sharp";
import { hashBytes } from "./hash";
import type { BuiltFile, PublishImage } from "./types";

/** The widths we make for every picture. */
export const IMAGE_WIDTHS = [320, 640, 1024, 1600];

export type PreparedImage = {
  id: string;
  alt: string;
  width: number;
  height: number;
  src: string;
  srcSet: string;
  fileName: string;
};

export type PrepareImagesResult = {
  files: Record<string, BuiltFile>;
  images: Map<string, PreparedImage>;
  warnings: string[];
};

function toBytes(buffer: Buffer | Uint8Array): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

/**
 * Makes the picture sizes for one picture. Every size is a WebP file and the
 * biggest one also gets a JPG copy, so the site still works in old browsers.
 */
export async function prepareImage(
  image: PublishImage,
): Promise<{ files: Record<string, BuiltFile>; prepared: PreparedImage }> {
  const source = Buffer.from(image.bytes);
  const hash = hashBytes(image.bytes);
  const base = `assets/${hash}`;
  const files: Record<string, BuiltFile> = {};

  const meta = await sharp(source).metadata();
  const originalWidth = image.width ?? meta.width ?? 1600;
  const originalHeight =
    image.height ?? meta.height ?? Math.round((originalWidth * 2) / 3);

  const widths = IMAGE_WIDTHS.filter((width) => width <= originalWidth);
  if (widths.length === 0) widths.push(originalWidth);
  if (!widths.includes(originalWidth)) widths.push(originalWidth);
  widths.sort((a, b) => a - b);

  const variants: { width: number; height: number; fileName: string }[] = [];

  for (const width of widths) {
    const height = Math.max(
      1,
      Math.round((originalHeight / originalWidth) * width),
    );
    const fileName = `${base}-${width}w.webp`;
    const body = await sharp(source)
      .resize({ width, height, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
    files[fileName] = {
      body: toBytes(body),
      contentType: "image/webp",
      size: body.byteLength,
    };
    variants.push({ width, height, fileName });
  }

  const largest = variants[variants.length - 1]!;
  const jpgName = `${base}-${largest.width}w.jpg`;
  const jpg = await sharp(source)
    .resize({
      width: largest.width,
      height: largest.height,
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
  files[jpgName] = {
    body: toBytes(jpg),
    contentType: "image/jpeg",
    size: jpg.byteLength,
  };

  const srcSet = [
    ...variants.map(
      (variant) =>
        `/assets/${variant.fileName.split("/")[1]} ${variant.width}w`,
    ),
    `/assets/${jpgName.split("/")[1]} ${largest.width}w`,
  ].join(", ");

  return {
    files,
    prepared: {
      id: image.id,
      alt: image.alt ?? "",
      width: largest.width,
      height: largest.height,
      src: `/assets/${largest.fileName.split("/")[1]}`,
      srcSet,
      fileName: largest.fileName,
    },
  };
}

/** Prepares every picture of the website. */
export async function prepareImages(
  images: PublishImage[],
): Promise<PrepareImagesResult> {
  const files: Record<string, BuiltFile> = {};
  const prepared = new Map<string, PreparedImage>();
  const warnings: string[] = [];

  for (const image of images) {
    try {
      const result = await prepareImage(image);
      Object.assign(files, result.files);
      prepared.set(image.id, result.prepared);
    } catch {
      warnings.push(
        "One of your pictures could not be prepared and was left out.",
      );
    }
  }

  return { files, images: prepared, warnings };
}
