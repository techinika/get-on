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
  starter: { hero: "horizon-waves", sections: ["craft-mosaic", "soft-orbitals"], portrait: "botanical-arches", logo: "horizon-waves" },
  "software-company": { hero: "geometric-grid", sections: ["soft-orbitals", "editorial-stripes"], portrait: "geometric-grid", logo: "soft-orbitals" },
  "law-firm": { hero: "editorial-stripes", sections: ["layered-peaks", "geometric-grid"], portrait: "editorial-stripes", logo: "layered-peaks" },
  restaurant: { hero: "craft-mosaic", sections: ["layered-peaks", "botanical-arches"], portrait: "craft-mosaic", logo: "soft-orbitals" },
  "developer-portfolio": { hero: "geometric-grid", sections: ["editorial-stripes", "geometric-grid"], portrait: "editorial-stripes", logo: "geometric-grid" },
  "salon-beauty": { hero: "botanical-arches", sections: ["soft-orbitals", "horizon-waves"], portrait: "botanical-arches", logo: "soft-orbitals" },
  "boutique-shop": { hero: "Studio-collage", sections: ["craft-mosaic", "botanical-arches"], portrait: "Studio-collage", logo: "craft-mosaic" },
  "home-services": { hero: "horizon-waves", sections: ["soft-orbitals", "layered-peaks"], portrait: "soft-orbitals", logo: "horizon-waves" },
  "community-church": { hero: "soft-orbitals", sections: ["horizon-waves", "botanical-arches"], portrait: "horizon-waves", logo: "craft-mosaic" },
  "creative-studio": { hero: "editorial-stripes", sections: ["Studio-collage", "editorial-stripes"], portrait: "Studio-collage", logo: "editorial-stripes" },
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

function prng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function renderArt(
  recipe: ArtRecipe | string,
  palette: ThemeColors,
  options: { width: number; height: number; seed: string },
): string {
  const { width, height, seed } = options;
  const rnd = prng(hashString(`${recipe}:${seed}`));
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-hidden="true">`;
  const parts: string[] = [];

  switch (recipe) {
    case "geometric-grid": {
      parts.push(`<rect width="${width}" height="${height}" fill="${palette.background}" />`);
      const cols = 6;
      const rows = 4;
      const cw = width / cols;
      const ch = height / rows;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const x = Math.round(c * cw);
          const y = Math.round(r * ch);
          const w = Math.round(cw - 8);
          const h = Math.round(ch - 8);
          const pick = rnd();
          if (pick < 0.28) {
            parts.push(`<rect x="${x + 4}" y="${y + 4}" width="${w}" height="${h}" rx="12" fill="${palette.primary}" opacity="${(0.2 + rnd() * 0.65).toFixed(2)}" />`);
          } else if (pick < 0.52) {
            parts.push(`<circle cx="${Math.round(x + cw / 2)}" cy="${Math.round(y + ch / 2)}" r="${Math.round(Math.min(w, h) * 0.36)}" fill="${palette.accent}" opacity="0.78" />`);
          } else if (pick < 0.78) {
            parts.push(`<rect x="${x + 4}" y="${y + 4}" width="${w}" height="${h}" rx="12" fill="${palette.soft}" stroke="${palette.primary}" stroke-opacity="0.22" stroke-width="2" />`);
          }
        }
      }
      parts.push(`<circle cx="${Math.round(width * (0.25 + rnd() * 0.5))}" cy="${Math.round(height * 0.5)}" r="${Math.round(Math.min(width, height) * 0.14)}" fill="${palette.primary}" />`);
      break;
    }
    case "botanical-arches": {
      parts.push(`<rect width="${width}" height="${height}" fill="${palette.soft}" />`);
      const archW = Math.round(width * 0.38);
      const archH = Math.round(height * 0.72);
      const x1 = Math.round(width * 0.14 + rnd() * width * 0.08);
      const y1 = Math.round(height - archH * 0.9);
      const rad = Math.round(archW / 2);
      parts.push(`<path d="M ${x1} ${height} L ${x1} ${y1 + rad} A ${rad} ${rad} 0 0 1 ${x1 + archW} ${y1 + rad} L ${x1 + archW} ${height} Z" fill="${palette.primary}" opacity="0.86" />`);
      const x2 = Math.round(width * 0.52 + rnd() * width * 0.08);
      const archW2 = Math.round(width * 0.28);
      const rad2 = Math.round(archW2 / 2);
      const y2 = Math.round(height * 0.28);
      parts.push(`<path d="M ${x2} ${height} L ${x2} ${y2 + rad2} A ${rad2} ${rad2} 0 0 1 ${x2 + archW2} ${y2 + rad2} L ${x2 + archW2} ${height} Z" fill="${palette.accent}" opacity="0.72" />`);
      parts.push(`<ellipse cx="${Math.round(x1 + archW * 0.75)}" cy="${Math.round(height * 0.34)}" rx="${Math.round(width * 0.07)}" ry="${Math.round(height * 0.18)}" transform="rotate(-22 ${Math.round(x1 + archW * 0.75)} ${Math.round(height * 0.34)})" fill="${palette.background}" opacity="0.75" />`);
      parts.push(`<circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.2)}" r="${Math.round(Math.min(width, height) * 0.07)}" fill="${palette.primary}" opacity="0.35" />`);
      break;
    }
    case "layered-peaks": {
      parts.push(`<rect width="${width}" height="${height}" fill="${palette.soft}" />`);
      parts.push(`<circle cx="${Math.round(width * (0.2 + rnd() * 0.6))}" cy="${Math.round(height * 0.24)}" r="${Math.round(Math.min(width, height) * 0.13)}" fill="${palette.accent}" opacity="0.88" />`);
      const midY = Math.round(height * (0.42 + rnd() * 0.1));
      parts.push(`<polygon points="0,${height} ${Math.round(width * 0.28)},${midY} ${Math.round(width * 0.58)},${Math.round(height * 0.68)} ${Math.round(width * 0.84)},${midY - 24} ${width},${Math.round(height * 0.58)} ${width},${height}" fill="${palette.primary}" opacity="0.45" />`);
      parts.push(`<polygon points="0,${height} ${Math.round(width * 0.2)},${Math.round(height * 0.72)} ${Math.round(width * 0.52)},${Math.round(height * 0.48)} ${Math.round(width * 0.8)},${Math.round(height * 0.76)} ${width},${Math.round(height * 0.64)} ${width},${height}" fill="${palette.primary}" opacity="0.85" />`);
      parts.push(`<path d="M 0 ${Math.round(height * 0.84)} Q ${Math.round(width * 0.5)} ${Math.round(height * 0.74)} ${width} ${Math.round(height * 0.88)} L ${width} ${height} L 0 ${height} Z" fill="${palette.background}" opacity="0.35" />`);
      break;
    }
    case "soft-orbitals": {
      parts.push(`<rect width="${width}" height="${height}" fill="${palette.background}" />`);
      const cx = Math.round(width * (0.42 + rnd() * 0.16));
      const cy = Math.round(height * (0.44 + rnd() * 0.12));
      const maxR = Math.round(Math.min(width, height) * 0.42);
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${maxR}" fill="${palette.soft}" />`);
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${Math.round(maxR * 0.76)}" fill="none" stroke="${palette.primary}" stroke-width="3" stroke-opacity="0.35" />`);
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${Math.round(maxR * 0.52)}" fill="${palette.primary}" opacity="0.82" />`);
      parts.push(`<circle cx="${Math.round(cx + maxR * 0.62)}" cy="${Math.round(cy - maxR * 0.36)}" r="${Math.round(maxR * 0.24)}" fill="${palette.accent}" opacity="0.86" />`);
      parts.push(`<circle cx="${Math.round(cx - maxR * 0.55)}" cy="${Math.round(cy + maxR * 0.42)}" r="${Math.round(maxR * 0.14)}" fill="${palette.text}" opacity="0.16" />`);
      break;
    }
    case "editorial-stripes": {
      parts.push(`<rect width="${width}" height="${height}" fill="${palette.background}" />`);
      const bands = 7;
      const bw = Math.round(width / bands);
      for (let i = 0; i < bands; i += 1) {
        const fill = i % 3 === 0 ? palette.primary : i % 3 === 1 ? palette.soft : palette.accent;
        const op = i % 3 === 0 ? (0.14 + rnd() * 0.16).toFixed(2) : i % 3 === 2 ? "0.22" : "0.75";
        parts.push(`<rect x="${i * bw}" y="0" width="${bw}" height="${height}" fill="${fill}" opacity="${op}" />`);
      }
      const cardX = Math.round(width * (0.18 + rnd() * 0.15));
      const cardY = Math.round(height * 0.2);
      parts.push(`<rect x="${cardX}" y="${cardY}" width="${Math.round(width * 0.48)}" height="${Math.round(height * 0.58)}" rx="10" fill="${palette.primary}" />`);
      parts.push(`<rect x="${cardX + Math.round(width * 0.08)}" y="${cardY + Math.round(height * 0.1)}" width="${Math.round(width * 0.22)}" height="${Math.round(height * 0.07)}" rx="6" fill="${palette.accent}" />`);
      break;
    }
    case "Studio-collage": {
      parts.push(`<rect width="${width}" height="${height}" fill="${palette.soft}" />`);
      const angle = Math.round(-12 + rnd() * 24);
      parts.push(`<polygon points="${Math.round(width * 0.55)},0 ${width},0 ${width},${height} ${Math.round(width * 0.3)},${height}" fill="${palette.primary}" opacity="0.18" />`);
      parts.push(`<rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.18)}" width="${Math.round(width * 0.44)}" height="${Math.round(height * 0.56)}" rx="16" transform="rotate(${angle} ${Math.round(width * 0.34)} ${Math.round(height * 0.46)})" fill="${palette.primary}" opacity="0.9" />`);
      parts.push(`<circle cx="${Math.round(width * 0.7)}" cy="${Math.round(height * 0.36)}" r="${Math.round(Math.min(width, height) * 0.2)}" fill="${palette.accent}" opacity="0.88" />`);
      parts.push(`<rect x="${Math.round(width * 0.48)}" y="${Math.round(height * 0.54)}" width="${Math.round(width * 0.34)}" height="${Math.round(height * 0.24)}" rx="24" fill="${palette.background}" stroke="${palette.primary}" stroke-width="3" stroke-opacity="0.3" />`);
      break;
    }
    case "craft-mosaic": {
      parts.push(`<rect width="${width}" height="${height}" fill="${palette.soft}" />`);
      const size = Math.round(Math.min(width, height) * 0.22);
      const cols = Math.ceil(width / size);
      const rows = Math.ceil(height / size);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const x = c * size;
          const y = r * size;
          const shade = (r + c) % 3 === 0 ? palette.primary : (r + c) % 3 === 1 ? palette.accent : palette.background;
          const op = (0.28 + rnd() * 0.55).toFixed(2);
          if ((r + c) % 2 === 0) {
            parts.push(`<path d="M ${x} ${y + size} A ${size} ${size} 0 0 1 ${x + size} ${y} L ${x + size} ${y + size} Z" fill="${shade}" opacity="${op}" />`);
          } else {
            parts.push(`<path d="M ${x} ${y} L ${x + size} ${y} A ${size} ${size} 0 0 1 ${x} ${y + size} Z" fill="${shade}" opacity="${op}" />`);
          }
        }
      }
      parts.push(`<circle cx="${Math.round(width * 0.5)}" cy="${Math.round(height * 0.5)}" r="${Math.round(size * 0.55)}" fill="${palette.primary}" />`);
      break;
    }
    case "horizon-waves":
    default: {
      parts.push(`<rect width="${width}" height="${height}" fill="${palette.soft}" />`);
      const sunX = Math.round(width * (0.25 + rnd() * 0.5));
      const sunY = Math.round(height * (0.25 + rnd() * 0.14));
      const sunR = Math.round(Math.min(width, height) * 0.16);
      parts.push(`<circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${palette.accent}" opacity="0.88" />`);
      const y1 = Math.round(height * 0.52 + rnd() * 24);
      const y2 = Math.round(height * 0.68 + rnd() * 24);
      const y3 = Math.round(height * 0.82);
      parts.push(`<path d="M 0 ${y1} Q ${Math.round(width * 0.35)} ${y1 - 54} ${Math.round(width * 0.68)} ${y1 + 18} T ${width} ${y1 - 12} L ${width} ${height} L 0 ${height} Z" fill="${palette.primary}" opacity="0.34" />`);
      parts.push(`<path d="M 0 ${y2} Q ${Math.round(width * 0.28)} ${y2 + 40} ${Math.round(width * 0.65)} ${y2 - 36} T ${width} ${y2 + 12} L ${width} ${height} L 0 ${height} Z" fill="${palette.primary}" opacity="0.62" />`);
      parts.push(`<path d="M 0 ${y3} Q ${Math.round(width * 0.45)} ${y3 - 34} ${width} ${y3 + 14} L ${width} ${height} L 0 ${height} Z" fill="${palette.primary}" opacity="0.92" />`);
      break;
    }
  }

  return `${head}${parts.join("")}</svg>`;
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
