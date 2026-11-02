export type TemplateImageKind = "hero" | "section" | "portrait" | "logo" | "photo";

export type TemplateImage = {
  id: string;
  key: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  slug: string;
  kind: TemplateImageKind;
};

const SLUGS = [
  "starter",
  "software-company",
  "law-firm",
  "restaurant",
  "developer-portfolio",
  "salon-beauty",
  "boutique-shop",
  "home-services",
  "community-church",
  "creative-studio",
] as const;

type ArtKey = "hero" | "section-1" | "section-2" | "portrait" | "logo";

const ART: Array<{ key: ArtKey; kind: TemplateImageKind; width: number; height: number; alt: string }> = [
  { key: "hero", kind: "hero", width: 1600, height: 1200, alt: "Template hero artwork" },
  { key: "section-1", kind: "section", width: 1200, height: 900, alt: "Template section artwork" },
  { key: "section-2", kind: "section", width: 1200, height: 900, alt: "Template section artwork" },
  { key: "portrait", kind: "portrait", width: 600, height: 600, alt: "Template portrait artwork" },
  { key: "logo", kind: "logo", width: 480, height: 160, alt: "Template logo artwork" },
];

const PHOTOS: Array<{ key: string; width: number; height: number; alt: string }> = [
  { key: "photo-1", width: 1600, height: 1067, alt: "A calm, welcoming place" },
  { key: "photo-2", width: 1600, height: 1067, alt: "A warm, everyday scene" },
  { key: "photo-3", width: 1600, height: 1066, alt: "A natural, open landscape" },
];

function hash(value: string): number {
  let out = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}

function idFor(key: string): string {
  const hex = [0, 1, 2, 3]
    .map((seed) => hash(`${key}:${seed}`).toString(16).padStart(8, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function image(key: string, fields: Omit<TemplateImage, "id" | "key">): TemplateImage {
  return { id: idFor(key), key, ...fields };
}

const ALL: TemplateImage[] = [
  ...SLUGS.flatMap((slug) =>
    ART.map((item) =>
      image(`${slug}/${item.key}`, {
        src: `/template-art/${slug}/${item.key}.webp`,
        alt: item.alt,
        width: item.width,
        height: item.height,
        slug,
        kind: item.kind,
      }),
    ),
  ),
  ...PHOTOS.map((item) =>
    image(`shared/${item.key}`, {
      src: `/template-art/shared/${item.key}.webp`,
      alt: item.alt,
      width: item.width,
      height: item.height,
      slug: "shared",
      kind: "photo",
    }),
  ),
];

const BY_ID = new Map(ALL.map((item) => [item.id, item]));
const BY_KEY = new Map(ALL.map((item) => [item.key, item]));

export function templateImage(slug: string, key: ArtKey): TemplateImage {
  return BY_KEY.get(`${slug}/${key}`) ?? BY_KEY.get(`starter/${key}`)!;
}

export function sharedTemplateImages(): TemplateImage[] {
  return PHOTOS.map((item) => BY_KEY.get(`shared/${item.key}`)!);
}

export function templateImagesForSlug(slug: string): TemplateImage[] {
  return ART.map((item) => templateImage(slug, item.key));
}

export function templateImageById(id: string): TemplateImage | null {
  return BY_ID.get(id) ?? null;
}

export function templateImageByKey(key: string): TemplateImage | null {
  return BY_KEY.get(key) ?? null;
}

export function templateImages(): TemplateImage[] {
  return ALL;
}

/** A renderer map for every built-in image. */
export function builtinImageMap(): Map<
  string,
  { src: string; alt: string; width: number; height: number }
> {
  return new Map(
    ALL.map((item) => [
      item.id,
      { src: item.src, alt: item.alt, width: item.width, height: item.height },
    ]),
  );
}
