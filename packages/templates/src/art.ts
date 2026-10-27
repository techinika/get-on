export type ArtPalette = {
  primary: string;
  accent: string;
  background: string;
  text: string;
  soft: string;
};

export type ArtRecipe =
  | "mesh-gradient"
  | "isometric-blocks"
  | "arch-composition"
  | "grain-gradient"
  | "botanical-lines"
  | "halftone"
  | "terminal-grid"
  | "blob-field"
  | "still-life-shapes"
  | "geometric-tiles";

export type ArtKind = "hero" | "section" | "portrait" | "logo";

export type Artwork = {
  key: string;
  kind: ArtKind;
  recipe: ArtRecipe;
  width: number;
  height: number;
  alt: string;
  svg: string;
};

export type ArtPlan = {
  hero: ArtRecipe;
  sections: [ArtRecipe, ArtRecipe];
  portrait: ArtRecipe;
  logo: ArtRecipe;
};

const PLANS: Record<string, ArtPlan> = {
  starter: { hero: "mesh-gradient", sections: ["blob-field", "geometric-tiles"], portrait: "halftone", logo: "geometric-tiles" },
  "software-company": { hero: "mesh-gradient", sections: ["isometric-blocks", "terminal-grid"], portrait: "halftone", logo: "geometric-tiles" },
  "law-firm": { hero: "arch-composition", sections: ["grain-gradient", "botanical-lines"], portrait: "grain-gradient", logo: "arch-composition" },
  restaurant: { hero: "grain-gradient", sections: ["still-life-shapes", "botanical-lines"], portrait: "still-life-shapes", logo: "blob-field" },
  "developer-portfolio": { hero: "terminal-grid", sections: ["halftone", "isometric-blocks"], portrait: "terminal-grid", logo: "geometric-tiles" },
  "salon-beauty": { hero: "blob-field", sections: ["arch-composition", "botanical-lines"], portrait: "arch-composition", logo: "blob-field" },
  "boutique-shop": { hero: "still-life-shapes", sections: ["grain-gradient", "geometric-tiles"], portrait: "still-life-shapes", logo: "geometric-tiles" },
  "home-services": { hero: "isometric-blocks", sections: ["geometric-tiles", "halftone"], portrait: "isometric-blocks", logo: "isometric-blocks" },
  "community-church": { hero: "blob-field", sections: ["botanical-lines", "grain-gradient"], portrait: "blob-field", logo: "arch-composition" },
  "creative-studio": { hero: "geometric-tiles", sections: ["halftone", "geometric-tiles"], portrait: "halftone", logo: "geometric-tiles" },
};

export const ART_RECIPES: ArtRecipe[] = [
  "mesh-gradient",
  "isometric-blocks",
  "arch-composition",
  "grain-gradient",
  "botanical-lines",
  "halftone",
  "terminal-grid",
  "blob-field",
  "still-life-shapes",
  "geometric-tiles",
];

const ALT: Record<ArtRecipe, string> = {
  "mesh-gradient": "Soft colour mesh in the website colours",
  "isometric-blocks": "Flat isometric shapes in the website colours",
  "arch-composition": "Layered arches in the website colours",
  "grain-gradient": "Soft gradient with a fine paper grain",
  "botanical-lines": "Simple botanical line shapes",
  halftone: "Dot pattern in the website colours",
  "terminal-grid": "Technical grid and panel shapes",
  "blob-field": "Soft organic shapes in the website colours",
  "still-life-shapes": "Simple product silhouettes on a warm background",
  "geometric-tiles": "Geometric tiles in the website colours",
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

function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function svg(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${body}</svg>`;
}

function meshGradient(p: ArtPalette, w: number, h: number, r: () => number): string {
  const blobs = Array.from({ length: 5 }, (_, index) => {
    const x = r() * w;
    const y = r() * h;
    const radius = (0.24 + r() * 0.34) * Math.max(w, h);
    const colour = index % 2 === 0 ? p.primary : p.accent;
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(radius)}" fill="${colour}" opacity="${n(0.18 + r() * 0.22)}"/>`;
  }).join("");
  return svg(w, h, `<defs><filter id="blur"><feGaussianBlur stdDeviation="${n(Math.max(w, h) * 0.09)}"/></filter></defs><rect width="${w}" height="${h}" fill="${p.background}"/><g filter="url(#blur)">${blobs}</g><rect x="${n(w * 0.08)}" y="${n(h * 0.12)}" width="${n(w * 0.44)}" height="${n(h * 0.76)}" rx="${n(w * 0.03)}" fill="${p.soft}" opacity="0.34"/>`);
}

function isometricBlocks(p: ArtPalette, w: number, h: number, r: () => number): string {
  const base = Math.min(w, h) * 0.16;
  const blocks = Array.from({ length: 7 }, (_, index) => {
    const x = w * (0.16 + r() * 0.64);
    const y = h * (0.24 + r() * 0.52);
    const size = base * (0.55 + r() * 0.85);
    const dx = size * 0.866;
    const dy = size * 0.5;
    const top = `${n(x)},${n(y - size)} ${n(x + dx)},${n(y - size + dy)} ${n(x)},${n(y - size + dy * 2)} ${n(x - dx)},${n(y - size + dy)}`;
    const left = `${n(x - dx)},${n(y - size + dy)} ${n(x)},${n(y - size + dy * 2)} ${n(x)},${n(y + dy * 2)} ${n(x - dx)},${n(y + dy)}`;
    const right = `${n(x + dx)},${n(y - size + dy)} ${n(x)},${n(y - size + dy * 2)} ${n(x)},${n(y + dy * 2)} ${n(x + dx)},${n(y + dy)}`;
    const topColour = index % 3 === 0 ? p.accent : p.soft;
    return `<polygon points="${top}" fill="${topColour}"/><polygon points="${left}" fill="${p.primary}" opacity="0.9"/><polygon points="${right}" fill="${p.text}" opacity="0.35"/>`;
  }).join("");
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.background}"/>${blocks}`);
}

function archComposition(p: ArtPalette, w: number, h: number, r: () => number): string {
  const arches = Array.from({ length: 4 }, (_, index) => {
    const width = w * (0.3 + r() * 0.3);
    const height = h * (0.42 + r() * 0.4);
    const x = w * (0.08 + index * 0.19);
    const y = h - height * 0.72;
    const colour = index % 2 === 0 ? p.soft : p.accent;
    return `<path d="M${n(x)} ${n(y + height)} V${n(y + width / 2)} A${n(width / 2)} ${n(width / 2)} 0 0 1 ${n(x + width)} ${n(y + width / 2)} V${n(y + height)} Z" fill="${colour}" opacity="${n(0.35 + r() * 0.4)}"/>`;
  }).join("");
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.background}"/>${arches}<circle cx="${n(w * 0.78)}" cy="${n(h * 0.24)}" r="${n(Math.min(w, h) * 0.12)}" fill="${p.primary}" opacity="0.24"/>`);
}

function grainGradient(p: ArtPalette, w: number, h: number, r: () => number): string {
  const angle = 20 + r() * 50;
  return svg(w, h, `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${n(angle)} 0.5 0.5)"><stop stop-color="${p.primary}" stop-opacity="0.9"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0.72"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" seed="${Math.floor(r() * 100)}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.14"/></feComponentTransfer></filter></defs><rect width="${w}" height="${h}" fill="${p.background}"/><rect x="${n(w * 0.08)}" y="${n(h * 0.1)}" width="${n(w * 0.84)}" height="${n(h * 0.8)}" rx="${n(w * 0.04)}" fill="url(#g)"/><rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.7"/>`);
}

function botanicalLines(p: ArtPalette, w: number, h: number, r: () => number): string {
  const stems = Array.from({ length: 4 }, (_, index) => {
    const x = w * (0.16 + index * 0.22);
    const top = h * (0.14 + r() * 0.2);
    const leaves = Array.from({ length: 5 }, (_, leaf) => {
      const y = top + ((h * 0.7) / 5) * leaf;
      const side = leaf % 2 === 0 ? -1 : 1;
      return `<path d="M${n(x)} ${n(y)} q${n(side * w * 0.07)} ${n(-h * 0.03)} ${n(side * w * 0.12)} 0 q${n(-side * w * 0.05)} ${n(h * 0.045)} ${n(-side * w * 0.12)} 0Z" fill="${p.primary}" opacity="0.34"/>`;
    }).join("");
    return `<path d="M${n(x)} ${n(h * 0.86)} C${n(x - w * 0.03)} ${n(h * 0.6)} ${n(x + w * 0.02)} ${n(h * 0.4)} ${n(x)} ${n(top)}" stroke="${p.accent}" stroke-width="${n(Math.max(2, w * 0.006))}" stroke-linecap="round"/>${leaves}`;
  }).join("");
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.background}"/><circle cx="${n(w * 0.82)}" cy="${n(h * 0.2)}" r="${n(Math.min(w, h) * 0.09)}" fill="${p.soft}"/>${stems}`);
}

function halftone(p: ArtPalette, w: number, h: number, r: () => number): string {
  const step = Math.max(10, Math.round(Math.min(w, h) / 34));
  const dots: string[] = [];
  for (let y = step; y < h; y += step) {
    for (let x = step; x < w; x += step) {
      const distance = Math.hypot(x - w * 0.7, y - h * 0.35) / Math.max(w, h);
      const radius = Math.max(0.8, (1 - distance) * step * 0.46 * (0.7 + r() * 0.5));
      dots.push(`<circle cx="${x}" cy="${y}" r="${n(radius)}" fill="${p.primary}" opacity="${n(0.18 + (1 - distance) * 0.55)}"/>`);
    }
  }
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.background}"/><rect x="${n(w * 0.08)}" y="${n(h * 0.12)}" width="${n(w * 0.38)}" height="${n(h * 0.72)}" rx="${n(w * 0.02)}" fill="${p.soft}"/>${dots.join("")}`);
}

function terminalGrid(p: ArtPalette, w: number, h: number, r: () => number): string {
  const lines: string[] = [];
  const step = Math.max(20, Math.round(Math.min(w, h) / 18));
  for (let x = 0; x <= w; x += step) lines.push(`<path d="M${x} 0V${h}" stroke="${p.primary}" stroke-opacity="0.14"/>`);
  for (let y = 0; y <= h; y += step) lines.push(`<path d="M0 ${y}H${w}" stroke="${p.primary}" stroke-opacity="0.14"/>`);
  const bars = Array.from({ length: 9 }, (_, index) => {
    const x = w * (0.12 + r() * 0.72);
    const y = h * (0.12 + r() * 0.7);
    const width = w * (0.06 + r() * 0.22);
    return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(Math.max(3, h * 0.012))}" rx="2" fill="${index % 4 === 0 ? p.accent : p.primary}" opacity="${n(0.4 + r() * 0.5)}"/>`;
  }).join("");
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.background}"/>${lines.join("")}<rect x="${n(w * 0.08)}" y="${n(h * 0.16)}" width="${n(w * 0.46)}" height="${n(h * 0.66)}" rx="8" fill="${p.soft}" opacity="0.55"/>${bars}<circle cx="${n(w * 0.78)}" cy="${n(h * 0.32)}" r="${n(Math.min(w, h) * 0.11)}" stroke="${p.accent}" stroke-width="2" opacity="0.7"/>`);
}

function blobField(p: ArtPalette, w: number, h: number, r: () => number): string {
  const blobs = Array.from({ length: 4 }, (_, index) => {
    const x = w * (0.12 + r() * 0.72);
    const y = h * (0.14 + r() * 0.68);
    const radius = Math.min(w, h) * (0.16 + r() * 0.2);
    const colour = index % 2 === 0 ? p.soft : p.accent;
    return `<path d="M${n(x - radius)} ${n(y)} C${n(x - radius)} ${n(y - radius * 1.3)} ${n(x + radius * 0.7)} ${n(y - radius * 1.4)} ${n(x + radius)} ${n(y - radius * 0.2)} C${n(x + radius * 1.2)} ${n(y + radius)} ${n(x - radius * 0.2)} ${n(y + radius * 1.2)} ${n(x - radius)} ${n(y)}Z" fill="${colour}" opacity="${n(0.28 + r() * 0.35)}"/>`;
  }).join("");
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.background}"/>${blobs}<circle cx="${n(w * 0.74)}" cy="${n(h * 0.28)}" r="${n(Math.min(w, h) * 0.15)}" fill="${p.primary}" opacity="0.16"/>`);
}

function stillLifeShapes(p: ArtPalette, w: number, h: number, r: () => number): string {
  const items = Array.from({ length: 5 }, (_, index) => {
    const x = w * (0.12 + index * 0.17 + r() * 0.03);
    const base = h * 0.78;
    const height = h * (0.2 + r() * 0.26);
    const width = w * (0.08 + r() * 0.05);
    const colour = index % 2 === 0 ? p.primary : p.accent;
    if (index % 3 === 2) {
      return `<circle cx="${n(x + width / 2)}" cy="${n(base - height / 2)}" r="${n(width / 2)}" fill="${colour}" opacity="0.82"/><ellipse cx="${n(x + width / 2)}" cy="${n(base + 4)}" rx="${n(width * 0.7)}" ry="${n(h * 0.012)}" fill="${p.text}" opacity="0.12"/>`;
    }
    return `<rect x="${n(x)}" y="${n(base - height)}" width="${n(width)}" height="${n(height)}" rx="${n(width * 0.18)}" fill="${colour}" opacity="0.82"/><ellipse cx="${n(x + width / 2)}" cy="${n(base + 4)}" rx="${n(width * 0.7)}" ry="${n(h * 0.012)}" fill="${p.text}" opacity="0.12"/>`;
  }).join("");
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.background}"/><rect y="${n(h * 0.78)}" width="${w}" height="${n(h * 0.22)}" fill="${p.soft}" opacity="0.55"/>${items}`);
}

function geometricTiles(p: ArtPalette, w: number, h: number, r: () => number): string {
  const tile = Math.max(28, Math.round(Math.min(w, h) / 7));
  const shapes: string[] = [];
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      const pick = r();
      if (pick < 0.34) {
        shapes.push(`<rect x="${x}" y="${y}" width="${tile}" height="${tile}" fill="${pick < 0.16 ? p.primary : p.soft}" opacity="0.72"/>`);
      } else if (pick < 0.58) {
        shapes.push(`<circle cx="${n(x + tile / 2)}" cy="${n(y + tile / 2)}" r="${n(tile * 0.36)}" fill="${p.accent}" opacity="0.6"/>`);
      } else if (pick < 0.78) {
        shapes.push(`<path d="M${x} ${y + tile} L${x + tile} ${y + tile} L${x + tile} ${y}Z" fill="${p.primary}" opacity="0.42"/>`);
      }
    }
  }
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.background}"/>${shapes.join("")}`);
}

const RENDERERS: Record<ArtRecipe, (p: ArtPalette, w: number, h: number, r: () => number) => string> = {
  "mesh-gradient": meshGradient,
  "isometric-blocks": isometricBlocks,
  "arch-composition": archComposition,
  "grain-gradient": grainGradient,
  "botanical-lines": botanicalLines,
  halftone,
  "terminal-grid": terminalGrid,
  "blob-field": blobField,
  "still-life-shapes": stillLifeShapes,
  "geometric-tiles": geometricTiles,
};

export function renderArt(
  recipe: ArtRecipe,
  palette: ArtPalette,
  options: { width: number; height: number; seed?: string },
): string {
  const renderer = RENDERERS[recipe];
  if (!renderer) throw new Error(`UNKNOWN_ART_RECIPE:${recipe}`);
  return renderer(palette, options.width, options.height, random(options.seed ?? recipe));
}

export function artPlanFor(slug: string): ArtPlan {
  return PLANS[slug] ?? PLANS.starter!;
}

/** The five images every template ships with. */
export function templateArtwork(
  slug: string,
  palette: ArtPalette,
  seed = slug,
): Artwork[] {
  const plan = artPlanFor(slug);
  const sizes: Array<{ key: string; kind: ArtKind; recipe: ArtRecipe; width: number; height: number }> = [
    { key: "hero", kind: "hero", recipe: plan.hero, width: 1600, height: 1200 },
    { key: "section-1", kind: "section", recipe: plan.sections[0], width: 1200, height: 900 },
    { key: "section-2", kind: "section", recipe: plan.sections[1], width: 1200, height: 900 },
    { key: "portrait", kind: "portrait", recipe: plan.portrait, width: 600, height: 600 },
    { key: "logo", kind: "logo", recipe: plan.logo, width: 480, height: 160 },
  ];
  return sizes.map((item) => ({
    ...item,
    alt: ALT[item.recipe],
    svg: renderArt(item.recipe, palette, {
      width: item.width,
      height: item.height,
      seed: `${seed}:${item.key}`,
    }),
  }));
}
