import type { FeelId } from "./spec";

export type FontCategory = "serif" | "sans" | "mono" | "rounded" | "handwritten" | "display";

export type FontCatalogueEntry = {
  id: string;
  category: FontCategory;
  feels: FeelId[];
  aliases?: string[];
};

const font = (id: string, category: FontCategory, feels: FeelId[], aliases: string[] = []): FontCatalogueEntry => ({
  id,
  category,
  feels,
  aliases,
});

export const FONT_CATALOGUE: FontCatalogueEntry[] = [
  font("Manrope", "sans", ["modern", "friendly"]),
  font("Plus Jakarta Sans", "sans", ["modern", "friendly"]),
  font("Inter", "sans", ["modern", "techy"]),
  font("Bricolage Grotesque", "display", ["friendly", "quirky"]),
  font("Figtree", "sans", ["friendly", "modern"]),
  font("Space Grotesk", "sans", ["modern", "techy"]),
  font("Fraunces", "serif", ["friendly", "quirky"]),
  font("Nunito Sans", "sans", ["friendly", "modern"]),
  font("Nunito", "rounded", ["friendly", "quirky"]),
  font("Poppins", "rounded", ["friendly", "quirky"]),
  font("Open Sans", "sans", ["friendly", "modern"]),
  font("DM Serif Display", "serif", ["elegant", "bold"]),
  font("DM Sans", "sans", ["modern", "friendly"]),
  font("Playfair Display", "serif", ["elegant", "classic"]),
  font("Source Sans 3", "sans", ["modern", "friendly"]),
  font("Source Serif 4", "serif", ["classic", "modern"]),
  font("Libre Baskerville", "serif", ["classic", "elegant"]),
  font("Cormorant Garamond", "serif", ["elegant", "classic"]),
  font("Montserrat", "sans", ["modern", "bold"]),
  font("Lora", "serif", ["friendly", "classic"]),
  font("Merriweather", "serif", ["classic", "friendly"]),
  font("Karla", "sans", ["friendly", "modern"]),
  font("Oswald", "display", ["bold", "modern"]),
  font("Work Sans", "sans", ["modern", "friendly"]),
  font("JetBrains Mono", "mono", ["techy", "modern"]),
  font("Lexend", "sans", ["modern", "friendly"]),
  font("Young Serif", "serif", ["friendly", "quirky"]),
  font("Outfit", "sans", ["modern", "friendly"]),
  font("Archivo Black", "display", ["bold", "modern"]),
  font("Caveat", "handwritten", ["quirky", "friendly"]),
  font("Lato", "sans", ["friendly", "modern"]),
  font("Roboto", "sans", ["modern", "friendly"]),
  font("Roboto Slab", "serif", ["classic", "modern"]),
  font("Raleway", "sans", ["elegant", "modern"]),
  font("Rubik", "sans", ["friendly", "modern"]),
  font("Barlow", "sans", ["modern", "techy"]),
  font("IBM Plex Sans", "sans", ["techy", "modern"]),
  font("IBM Plex Mono", "mono", ["techy", "classic"]),
  font("Fira Sans", "sans", ["techy", "friendly"]),
  font("Fira Code", "mono", ["techy", "modern"]),
  font("Josefin Sans", "sans", ["elegant", "quirky"]),
  font("Quicksand", "rounded", ["quirky", "friendly"]),
  font("Comfortaa", "rounded", ["quirky", "friendly"]),
  font("Fredoka", "rounded", ["quirky", "friendly"]),
  font("Baloo 2", "rounded", ["quirky", "friendly"]),
  font("Righteous", "display", ["quirky", "bold"]),
  font("Bebas Neue", "display", ["bold", "modern"]),
  font("Anton", "display", ["bold", "modern"]),
  font("Teko", "display", ["bold", "techy"]),
  font("Cinzel", "serif", ["elegant", "classic"]),
  font("Marcellus", "serif", ["elegant", "classic"]),
  font("EB Garamond", "serif", ["elegant", "classic"]),
  font("Crimson Pro", "serif", ["elegant", "classic"]),
  font("Alegreya", "serif", ["friendly", "classic"]),
  font("Spectral", "serif", ["elegant", "modern"]),
  font("PT Serif", "serif", ["classic", "friendly"]),
  font("Noto Serif", "serif", ["classic", "modern"]),
  font("Noto Sans", "sans", ["modern", "friendly"]),
  font("Poppins", "rounded", ["friendly", "quirky"]),
  font("Sora", "sans", ["techy", "modern"]),
  font("Syne", "display", ["bold", "quirky"]),
  font("Unbounded", "display", ["bold", "quirky"]),
  font("Urbanist", "sans", ["modern", "friendly"]),
  font("Satoshi", "sans", ["modern", "friendly"]),
  font("General Sans", "sans", ["modern", "friendly"]),
  font("Clash Display", "display", ["bold", "modern"]),
];

export const FEEL_FONTS: Record<FeelId, { heading: string; body: string }> = {
  elegant: { heading: "Cormorant Garamond", body: "Montserrat" },
  modern: { heading: "Manrope", body: "Inter" },
  techy: { heading: "JetBrains Mono", body: "Inter" },
  friendly: { heading: "Bricolage Grotesque", body: "Figtree" },
  bold: { heading: "Archivo Black", body: "Work Sans" },
  classic: { heading: "Libre Baskerville", body: "Source Sans 3" },
  quirky: { heading: "Fraunces", body: "Nunito Sans" },
};

export const FEEL_WORDS: Record<FeelId, string[]> = {
  elegant: ["elegant", "luxury", "luxurious", "refined", "premium", "sophisticated"],
  modern: ["modern", "clean", "contemporary", "sleek", "minimal", "minimalist"],
  techy: ["techy", "technical", "developer", "futuristic", "digital", "mono", "code"],
  friendly: ["friendly", "friendly", "approachable", "cosy", "cozy", "welcoming"],
  bold: ["bold", "loud", "striking", "strong", "dramatic", "powerful"],
  classic: ["classic", "traditional", "timeless", "heritage", "formal"],
  quirky: ["quirky", "quirky", "fun", "creative", "artistic", "eclectic"],
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findFontName(text: string): { id: string; index: number } | null {
  let best: { id: string; index: number; length: number } | null = null;
  for (const entry of FONT_CATALOGUE) {
    for (const candidate of [entry.id, ...(entry.aliases ?? [])]) {
      const match = new RegExp(`\\b${escapeRegex(candidate)}\\b`, "i").exec(text);
      if (match && (!best || candidate.length > best.length)) {
        best = { id: entry.id, index: match.index, length: candidate.length };
      }
    }
  }
  return best ? { id: best.id, index: best.index } : null;
}

export function fontsByFeel(feel: FeelId): FontCatalogueEntry[] {
  return FONT_CATALOGUE.filter((entry) => entry.feels.includes(feel));
}
