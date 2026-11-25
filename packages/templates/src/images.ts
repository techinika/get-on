export type BuiltinTemplateImage = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
};

const SHARED_IMAGES: BuiltinTemplateImage[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    src: "/template-art/shared/photo-1.webp",
    alt: "Warm workspace scene with natural daylight",
    width: 1200,
    height: 800,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    src: "/template-art/shared/photo-2.webp",
    alt: "Clean storefront interior prepared for visitors",
    width: 1200,
    height: 800,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    src: "/template-art/shared/photo-3.webp",
    alt: "Friendly service consultation at a studio table",
    width: 1200,
    height: 800,
  },
];

const TEMPLATE_SLUGS = [
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

const SLUG_IMAGES: BuiltinTemplateImage[] = TEMPLATE_SLUGS.flatMap((slug, slugIdx) => {
  const hexIdx = (slugIdx + 1).toString(16).padStart(2, "0");
  const basePrefix = `200000${hexIdx}-0000-4000-8000-0000000000`;
  return [
    {
      id: `${basePrefix}01`,
      src: `/template-art/${slug}/hero.webp`,
      alt: `${slug.replaceAll("-", " ")} hero visual`,
      width: 1200,
      height: 800,
    },
    {
      id: `${basePrefix}02`,
      src: `/template-art/${slug}/section-1.webp`,
      alt: `${slug.replaceAll("-", " ")} primary section artwork`,
      width: 960,
      height: 640,
    },
    {
      id: `${basePrefix}03`,
      src: `/template-art/${slug}/section-2.webp`,
      alt: `${slug.replaceAll("-", " ")} secondary section artwork`,
      width: 960,
      height: 640,
    },
    {
      id: `${basePrefix}04`,
      src: `/template-art/${slug}/portrait.webp`,
      alt: `${slug.replaceAll("-", " ")} vertical portrait frame`,
      width: 720,
      height: 900,
    },
    {
      id: `${basePrefix}05`,
      src: `/template-art/${slug}/logo.webp`,
      alt: `${slug.replaceAll("-", " ")} brand emblem`,
      width: 400,
      height: 400,
    },
  ];
});

export function sharedTemplateImages(): BuiltinTemplateImage[] {
  return SHARED_IMAGES;
}

export function builtinImageMap(): Map<string, BuiltinTemplateImage> {
  const map = new Map<string, BuiltinTemplateImage>();
  for (const img of [...SHARED_IMAGES, ...SLUG_IMAGES]) {
    map.set(img.id, img);
  }
  return map;
}

export function templateImageById(id: string): BuiltinTemplateImage | null {
  return builtinImageMap().get(id) ?? null;
}

export function heroImageIdForSlug(slug: string): string {
  const idx = TEMPLATE_SLUGS.indexOf(slug as (typeof TEMPLATE_SLUGS)[number]);
  const hexIdx = ((idx === -1 ? 0 : idx) + 1).toString(16).padStart(2, "0");
  return `200000${hexIdx}-0000-4000-8000-000000000001`;
}

export function imagesForSlug(slug: string): {
  hero: BuiltinTemplateImage;
  section1: BuiltinTemplateImage;
  section2: BuiltinTemplateImage;
  portrait: BuiltinTemplateImage;
  logo: BuiltinTemplateImage;
} {
  const idx = TEMPLATE_SLUGS.indexOf(slug as (typeof TEMPLATE_SLUGS)[number]);
  const hexIdx = ((idx === -1 ? 0 : idx) + 1).toString(16).padStart(2, "0");
  const prefix = `200000${hexIdx}-0000-4000-8000-0000000000`;
  const byId = builtinImageMap();
  const fallback = SHARED_IMAGES[0]!;
  return {
    hero: byId.get(`${prefix}01`) ?? fallback,
    section1: byId.get(`${prefix}02`) ?? SHARED_IMAGES[1] ?? fallback,
    section2: byId.get(`${prefix}03`) ?? SHARED_IMAGES[2] ?? fallback,
    portrait: byId.get(`${prefix}04`) ?? SHARED_IMAGES[1] ?? fallback,
    logo: byId.get(`${prefix}05`) ?? fallback,
  };
}
