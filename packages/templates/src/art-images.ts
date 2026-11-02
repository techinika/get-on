import type { Block } from "./types";
import {
  sharedTemplateImages,
  templateImage,
  templateImagesForSlug,
  type TemplateImage,
} from "./assets";

export type TemplateImageOptions = {
  slug: string;
  seed?: string;
};

function hash(value: string): number {
  let out = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}

function random(seed: string): () => number {
  let value = hash(seed) || 1;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(next: () => number, images: TemplateImage[]): TemplateImage {
  return images[Math.floor(next() * images.length)] ?? images[0]!;
}

function setImage(target: Record<string, unknown>, key: string, image: TemplateImage): void {
  if (target[key] == null || target[key] === "") target[key] = image.id;
}

function imageForBlock(
  type: string,
  layout: string | undefined,
  next: () => number,
  images: {
    hero: TemplateImage;
    sections: TemplateImage[];
    portrait: TemplateImage;
    logo: TemplateImage;
    photos: TemplateImage[];
  },
): TemplateImage {
  if (type === "hero") return images.hero;
  if (type === "team" || type === "testimonials") return pick(next, [images.portrait, ...images.photos]);
  if (type === "logos") return images.logo;
  if (type === "products" || type === "projects" || type === "gallery" || type === "features" || type === "services") {
    return pick(next, [...images.sections, ...images.photos]);
  }
  if (type === "image-text" || type === "image" || type === "before-after") {
    return pick(next, [...images.sections, ...images.photos]);
  }
  if (layout === "image-cards" || layout === "bento" || layout === "tiles" || layout === "rows") {
    return pick(next, [...images.sections, ...images.photos]);
  }
  return pick(next, z(images.sections, images.photos));
}

function z(sections: TemplateImage[], photos: TemplateImage[]): TemplateImage[] {
  return sections.length > 0 ? sections : photos;
}

function applyToBlock(
  block: Block,
  next: () => number,
  images: {
    hero: TemplateImage;
    sections: TemplateImage[];
    portrait: TemplateImage;
    logo: TemplateImage;
    photos: TemplateImage[];
  },
): void {
  const props = block.props;
  if (!props || typeof props !== "object") return;
  const propsRecord = props as Record<string, unknown>;
  const type = String(block.type);

  if (type === "hero" || type === "image" || type === "image-text") {
    setImage(propsRecord, "imageId", imageForBlock(type, String(propsRecord.layout ?? ""), next, images));
  }

  if (type === "gallery" && Array.isArray(propsRecord.items)) {
    for (const item of propsRecord.items) {
      if (item && typeof item === "object") setImage(item as Record<string, unknown>, "imageId", pick(next, [...images.sections, ...images.photos]));
    }
  }

  if (type === "products" || type === "projects") {
    if (Array.isArray(propsRecord.items)) {
      for (const item of propsRecord.items) {
        if (item && typeof item === "object") setImage(item as Record<string, unknown>, "imageId", pick(next, [...images.sections, ...images.photos]));
      }
    }
  }

  if (type === "features") {
    if (Array.isArray(propsRecord.items)) {
      for (const item of propsRecord.items) {
        if (item && typeof item === "object") setImage(item as Record<string, unknown>, "imageId", pick(next, [...images.sections, ...images.photos]));
      }
    }
  }

  if (type === "services") {
    if (Array.isArray(propsRecord.items)) {
      for (const item of propsRecord.items) {
        if (item && typeof item === "object") setImage(item as Record<string, unknown>, "imageId", pick(next, [...images.sections, ...images.photos]));
      }
    }
  }

  if (type === "team") {
    if (Array.isArray(propsRecord.items)) {
      for (const item of propsRecord.items) {
        if (item && typeof item === "object") setImage(item as Record<string, unknown>, "photoId", pick(next, [images.portrait, ...images.photos]));
      }
    }
  }

  if (type === "testimonials") {
    if (Array.isArray(propsRecord.items)) {
      for (const item of propsRecord.items) {
        if (item && typeof item === "object") setImage(item as Record<string, unknown>, "photoId", pick(next, [images.portrait, ...images.photos]));
      }
    }
  }

  if (type === "logos" && Array.isArray(propsRecord.items)) {
    for (const item of propsRecord.items) {
      if (item && typeof item === "object") setImage(item as Record<string, unknown>, "imageId", images.logo);
    }
  }

  if (type === "before-after" && Array.isArray(propsRecord.items)) {
    for (const item of propsRecord.items) {
      if (!item || typeof item !== "object") continue;
      const pair = item as Record<string, unknown>;
      setImage(pair, "beforeId", pick(next, [...images.sections, ...images.photos]));
      setImage(pair, "afterId", pick(next, [...images.sections, ...images.photos]));
    }
  }

  const sec = block.sec as Record<string, unknown> | undefined;
  const bg = sec?.bg as Record<string, unknown> | undefined;
  if (bg?.type === "image") setImage(bg, "imageId", pick(next, [...images.sections, ...images.photos]));
}

/**
 * Adds the built-in artwork that ships with a template. It only fills empty
 * picture slots, so a template can still set a specific image. The ids point
 * at static files, never at rows in the customer's Pictures library.
 */
export function withTemplateImages(blocks: Block[], options: TemplateImageOptions): Block[] {
  const pool = templateImagesForSlug(options.slug);
  const byKey = new Map(pool.map((item) => [item.key.split("/").pop(), item]));
  const images = {
    hero: byKey.get("hero")!,
    sections: [byKey.get("section-1")!, byKey.get("section-2")!],
    portrait: byKey.get("portrait")!,
    logo: byKey.get("logo")!,
    photos: sharedTemplateImages(),
  };

  return blocks.map((block, index) => {
    const copy = JSON.parse(JSON.stringify(block)) as Block;
    const key = `${options.seed ?? options.slug}:${String(copy.id ?? index)}`;
    applyToBlock(copy, random(key), images);
    return copy;
  });
}

/**
 * Puts a photo in the plain starter hero. New websites without a designed
 * template should still look like a real website, not an empty placeholder.
 */
export function withDefaultImages(blocks: Block[], seed = "default"): Block[] {
  const photos = sharedTemplateImages();
  const sections = photos;
  const images = {
    hero: photos[0]!,
    sections,
    portrait: photos[0]!,
    logo: photos[0]!,
    photos,
  };

  return blocks.map((block, index) => {
    const copy = JSON.parse(JSON.stringify(block)) as Block;
    const next = random(`${seed}:${String(copy.id ?? index)}`);
    const type = String(copy.type);
    const props = copy.props as Record<string, unknown> | undefined;

    if (type === "hero" && props && (props.imageId == null || props.imageId === "")) {
      const layout = String(props.layout ?? "text-only");
      if (layout === "text-only" || layout === "minimal" || layout === "auto") {
        props.layout = "split";
        props.imageSide = "right";
        props.imageRatio = "4:3";
      }
      props.imageId = pick(next, photos).id;
    }

    applyToBlock(copy, next, images);
    return copy;
  });
}
