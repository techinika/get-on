import fallback from '../fonts/catalog.fallback.json' with { type: 'json' };
import type { FontPairId } from './types';

export type FontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'monospace';
export type FontRecord = {
  id: string;
  family: string;
  category: FontCategory;
  weights: number[];
  subsets: string[];
  variable: boolean;
  license: string;
  popularity: number;
  sourceVersion?: string;
};

export const FALLBACK_FONTS = fallback as FontRecord[];

export const CURATED_IDS = FALLBACK_FONTS.map((font) => font.id);

export const FONT_PAIR_PRESETS: Record<FontPairId, { name: string; heading: string; body: string }> = {
  friendly: { name: 'Friendly', heading: 'bricolage-grotesque', body: 'figtree' },
  classic: { name: 'Classic', heading: 'playfair-display', body: 'source-sans-3' },
  modern: { name: 'Modern', heading: 'space-grotesk', body: 'inter' },
  warm: { name: 'Warm', heading: 'fraunces', body: 'nunito-sans' },
  editorial: { name: 'Editorial', heading: 'dm-serif-display', body: 'dm-sans' },
  clean: { name: 'Clean', heading: 'plus-jakarta-sans', body: 'plus-jakarta-sans' },
  bold: { name: 'Bold', heading: 'archivo-black', body: 'work-sans' },
  elegant: { name: 'Elegant', heading: 'cormorant-garamond', body: 'montserrat' },
  playful: { name: 'Playful', heading: 'poppins', body: 'open-sans' },
  handmade: { name: 'Handmade', heading: 'caveat', body: 'lato' },
  traditional: { name: 'Traditional', heading: 'lora', body: 'merriweather' },
  techy: { name: 'Techy', heading: 'outfit', body: 'inter' },
};

export const BUSINESS_STYLE_DEFAULTS = {
  restaurant: { palette: 'terracotta', heading: 'fraunces', body: 'nunito-sans' },
  'salon-beauty': { palette: 'blush', heading: 'playfair-display', body: 'karla' },
  shop: { palette: 'tomato', heading: 'outfit', body: 'inter' },
  portfolio: { palette: 'noir-gold', heading: 'space-grotesk', body: 'inter' },
  consultant: { palette: 'slate-blue', heading: 'source-serif-4', body: 'source-sans-3' },
  'church-community': { palette: 'forest-gold', heading: 'lora', body: 'nunito-sans' },
  'repair-services': { palette: 'graphite-orange', heading: 'oswald', body: 'open-sans' },
  'farm-agriculture': { palette: 'olive-grove', heading: 'young-serif', body: 'figtree' },
  'education-tutoring': { palette: 'violet', heading: 'lexend', body: 'nunito-sans' },
  other: { palette: 'fresh-green', heading: 'bricolage-grotesque', body: 'figtree' },
} as const;

export const BUSINESS_TYPE_FONTS: Record<string, string[]> = {
  restaurant: ['fraunces', 'playfair-display', 'lora', 'poppins', 'nunito-sans', 'figtree'],
  'salon-beauty': ['playfair-display', 'cormorant-garamond', 'karla', 'montserrat', 'lato', 'dm-sans'],
  shop: ['outfit', 'poppins', 'inter', 'work-sans', 'dm-sans', 'archivo-black'],
  portfolio: ['space-grotesk', 'archivo-black', 'inter', 'dm-sans', 'bricolage-grotesque', 'manrope'],
  consultant: ['source-serif-4', 'playfair-display', 'source-sans-3', 'inter', 'lora', 'public-sans'],
  'church-community': ['lora', 'merriweather', 'nunito-sans', 'open-sans', 'crimson-pro', 'figtree'],
  'repair-services': ['oswald', 'barlow', 'open-sans', 'roboto', 'work-sans', 'inter'],
  'farm-agriculture': ['young-serif', 'fraunces', 'figtree', 'source-sans-3', 'lora', 'karla'],
  'education-tutoring': ['lexend', 'poppins', 'nunito-sans', 'inter', 'rubik', 'dm-sans'],
  other: ['bricolage-grotesque', 'figtree', 'inter', 'space-grotesk', 'source-sans-3', 'lora'],
};

export function findFont(id: string, catalog: FontRecord[] = FALLBACK_FONTS): FontRecord | undefined {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return undefined;
  return catalog.find((font) => font.id === id);
}

export function nearestWeight(font: FontRecord, weight: number): number {
  if (font.weights.length === 0) return 400;
  return font.weights.reduce((best, w) => Math.abs(w - weight) < Math.abs(best - weight) ? w : best, font.weights[0]!);
}

export function fontSubsets(language?: string): string[] {
  const extended = new Set(['fr', 'es', 'pt', 'de', 'it']);
  return language && extended.has(language) ? ['latin', 'latin-ext'] : ['latin'];
}
