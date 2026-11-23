import type { ThemeColors } from "@get-on/blocks";

export const ART_RECIPES = [
  "horizon-waves",
  "botanical-arches",
  "geometric-grid",
  "layered-peaks",
  "soft-orbitals",
  "editorial-stripes",
  "Studio-collage",
  "craft-mosaic",
] as const;

export type ArtRecipe = (typeof ART_RECIPES)[number];

export type ArtPlan = {
  hero: ArtRecipe;
  sections: [ArtRecipe, ArtRecipe];
  portrait: ArtRecipe;
  logo: ArtRecipe;
};

const PLANS: Record<string, ArtPlan> = {
  starter: { hero: "horizon-waves", sections: ["geometric-grid", "soft-orbitals"], portrait: "botanical-arches", logo: "craft-mosaic" },
  "software-company": { hero: "geometric-grid", sections: ["editorial-stripes", "soft-orbitals"], portrait: "horizon-waves", logo: "geometric-grid" },
  "law-firm": { hero: "botanical-arches", sections: ["editorial-stripes", "layered-peaks"], portrait: "botanical-arches", logo: "editorial-stripes" },
  restaurant: { hero: "layered-peaks", sections: ["botanical-arches", "craft-mosaic"], portrait: "soft-orbitals", logo: "craft-mosaic" },
  "developer-portfolio": { hero: "editorial-stripes", sections: ["geometric-grid", "horizon-waves"], portrait: "geometric-grid", logo: "editorial-stripes" },
  "salon-beauty": { hero: "soft-orbitals", sections: ["botanical-arches", "horizon-waves"], portrait: "soft-orbitals", logo: "botanical-arches" },
  "boutique-shop": { hero: "craft-mosaic", sections: ["soft-orbitals", "botanical-arches"], portrait: "craft-mosaic", logo: "soft-orbitals" },
  "home-services": { hero: "Studio-collage", sections: ["layered-peaks", "geometric-grid"], portrait: "layered-peaks", logo: "geometric-grid" },
  "community-church": { hero: "botanical-arches", sections: ["horizon-waves", "soft-orbitals"], portrait: "horizon-waves", logo: "botanical-arches" },
  "creative-studio": { hero: "Studio-collage", sections: ["craft-mosaic", "editorial-stripes"], portrait: "editorial-stripes", logo: "Studio-collage" },
};

export function artPlanFor(slug: string): ArtPlan {
  return PLANS[slug] ?? PLANS.starter!;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function renderArt(
  recipe: ArtRecipe | string,
  palette: ThemeColors,
  options: { width: number; height: number; seed: string },
): string {
  const { width, height, seed } = options;
  const h = hashString(`${recipe}:${seed}`);
  const cx1 = 20 + (h % Math.max(40, Math.floor(width * 0.6)));
  const cy1 = 20 + ((h >>> 5) % Math.max(40, Math.floor(height * 0.6)));
  const r1 = Math.round(Math.min(width, height) * (0.22 + ((h % 15) / 100)));
  const cx2 = Math.round(width * 0.68) + ((h >>> 3) % 40) - 20;
  const cy2 = Math.round(height * 0.36) + ((h >>> 7) % 40) - 20;
  const waveY = Math.round(height * 0.62) + ((h >>> 9) % 35);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-hidden="true"><rect width="${width}" height="${height}" fill="${palette.soft}" /><circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="${palette.primary}" opacity="0.86" /><circle cx="${cx2}" cy="${cy2}" r="${Math.round(r1 * 0.72)}" fill="${palette.accent}" opacity="0.68" /><path d="M 0 ${waveY} Q ${Math.round(width * 0.4)} ${waveY - 60} ${width} ${waveY + 10} L ${width} ${height} L 0 ${height} Z" fill="${palette.primary}" opacity="0.24" /><rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.14)}" width="${Math.round(width * 0.25)}" height="${Math.round(height * 0.25)}" rx="18" fill="${palette.background}" opacity="0.7" /></svg>`;
}

export function templateArtwork(
  slug: string,
  palette: ThemeColors,
): Array<{
  key: string;
  kind: "hero" | "section" | "portrait" | "logo";
  recipe: ArtRecipe;
  width: number;
  height: number;
  alt: string;
  svg: string;
}> {
  const plan = artPlanFor(slug);
  return [
    {
      key: `${slug}-hero`,
      kind: "hero",
      recipe: plan.hero,
      width: 1200,
      height: 800,
      alt: `Abstract hero illustration for the ${slug} template design`,
      svg: renderArt(plan.hero, palette, { width: 1200, height: 800, seed: `${slug}:hero` }),
    },
    {
      key: `${slug}-section-1`,
      kind: "section",
      recipe: plan.sections[0],
      width: 960,
      height: 640,
      alt: `Primary editorial artwork for the ${slug} template sections`,
      svg: renderArt(plan.sections[0], palette, { width: 960, height: 640, seed: `${slug}:sec1` }),
    },
    {
      key: `${slug}-section-2`,
      kind: "section",
      recipe: plan.sections[1],
      width: 960,
      height: 640,
      alt: `Secondary editorial artwork for the ${slug} template sections`,
      svg: renderArt(plan.sections[1], palette, { width: 960, height: 640, seed: `${slug}:sec2` }),
    },
    {
      key: `${slug}-portrait`,
      kind: "portrait",
      recipe: plan.portrait,
      width: 720,
      height: 900,
      alt: `Vertical portrait frame illustration for the ${slug} template`,
      svg: renderArt(plan.portrait, palette, { width: 720, height: 900, seed: `${slug}:portrait` }),
    },
    {
      key: `${slug}-logo`,
      kind: "logo",
      recipe: plan.logo,
      width: 400,
      height: 400,
      alt: `Brand emblem geometric illustration for the ${slug} template`,
      svg: renderArt(plan.logo, palette, { width: 400, height: 400, seed: `${slug}:logo` }),
    },
  ];
}
