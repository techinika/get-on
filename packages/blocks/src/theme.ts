import type { Theme, ThemeColors } from './types';
import { deriveTokens } from './colour';

export const PALETTES: Record<string, ThemeColors & { name: string; group: string; dark?: Partial<ThemeColors> }> = {
  'fresh-green': { name: 'Fresh green', group: 'Fresh', primary: '#0B6B4F', accent: '#F5A524', background: '#FFFBF5', text: '#1F1A17', soft: '#E8F5EF' },
  'mint-fresh': { name: 'Mint', group: 'Fresh', primary: '#0F766E', accent: '#F59E0B', background: '#F6FBFA', text: '#10201E', soft: '#DDF3EF' },
  'olive-grove': { name: 'Olive grove', group: 'Fresh', primary: '#4D6B2F', accent: '#D97706', background: '#FAFAF3', text: '#1C2214', soft: '#EAF0DC' },
  meadow: { name: 'Meadow', group: 'Fresh', primary: '#3F7D20', accent: '#E11D74', background: '#FBFFF5', text: '#162410', soft: '#E6F5D6' },
  sunset: { name: 'Sunset', group: 'Warm', primary: '#D2541A', accent: '#1F7A6B', background: '#FFF9F3', text: '#2B1A12', soft: '#FDEBDD' },
  terracotta: { name: 'Terracotta', group: 'Warm', primary: '#B8472B', accent: '#2F6F73', background: '#FFF8F3', text: '#2A1A14', soft: '#F8E4D9' },
  honey: { name: 'Honey', group: 'Warm', primary: '#B45309', accent: '#1E3A5F', background: '#FFFBF0', text: '#2B2011', soft: '#FCEFC7' },
  'rose-clay': { name: 'Rose clay', group: 'Warm', primary: '#B4536B', accent: '#3F6B5A', background: '#FFF7F7', text: '#2D1B20', soft: '#F7E1E5' },
  coffee: { name: 'Coffee', group: 'Warm', primary: '#6B4423', accent: '#C98B2B', background: '#FBF7F2', text: '#231A12', soft: '#EFE3D3' },
  ocean: { name: 'Ocean', group: 'Cool', primary: '#1D5FA8', accent: '#F2994A', background: '#F7FAFD', text: '#14202E', soft: '#E6F0FB' },
  sky: { name: 'Sky', group: 'Cool', primary: '#0E7FB8', accent: '#F26B3A', background: '#F5FBFE', text: '#0F2230', soft: '#DDF1FA' },
  'indigo-ink': { name: 'Indigo ink', group: 'Cool', primary: '#3730A3', accent: '#14B8A6', background: '#F8F8FF', text: '#1B1A33', soft: '#E6E5FA' },
  'teal-deep': { name: 'Deep teal', group: 'Cool', primary: '#0B5E73', accent: '#F2A93B', background: '#F4FAFB', text: '#0E2229', soft: '#D9EEF2' },
  'slate-blue': { name: 'Slate blue', group: 'Cool', primary: '#3B5B8C', accent: '#E58F3A', background: '#F7F9FC', text: '#172033', soft: '#E3EAF5' },
  midnight: { name: 'Midnight', group: 'Bold', primary: '#3B3BA8', accent: '#F5C542', background: '#F7F7FC', text: '#18182E', soft: '#E9E9F8' },
  tomato: { name: 'Tomato', group: 'Bold', primary: '#D1352B', accent: '#1F2A44', background: '#FFFFFF', text: '#1A1412', soft: '#FDE7E4' },
  violet: { name: 'Violet', group: 'Bold', primary: '#6D28D9', accent: '#F59E0B', background: '#FBF8FF', text: '#21103A', soft: '#EEE5FB' },
  magenta: { name: 'Magenta', group: 'Bold', primary: '#BE185D', accent: '#0EA5A5', background: '#FFF7FB', text: '#2A0F1D', soft: '#FCE4F0' },
  'forest-gold': { name: 'Forest and gold', group: 'Bold', primary: '#14532D', accent: '#EAB308', background: '#F7FBF4', text: '#12220F', soft: '#DDEFD8' },
  berry: { name: 'Berry', group: 'Soft', primary: '#A3265C', accent: '#F5B83D', background: '#FFF8FA', text: '#2A1620', soft: '#FBE8F0' },
  blush: { name: 'Blush', group: 'Soft', primary: '#9D4B63', accent: '#7A8F6B', background: '#FFF9F9', text: '#2D1F24', soft: '#F9E8EC' },
  sage: { name: 'Sage', group: 'Soft', primary: '#5B7A63', accent: '#C27D50', background: '#F8FAF6', text: '#1E2A21', soft: '#E4EDE3' },
  lavender: { name: 'Lavender', group: 'Soft', primary: '#7358A8', accent: '#E0A33A', background: '#FBF9FE', text: '#261D36', soft: '#EDE7F7' },
  charcoal: { name: 'Charcoal', group: 'Neutral', primary: '#1F2937', accent: '#E0A526', background: '#FFFFFF', text: '#111827', soft: '#F1F3F5' },
  'noir-gold': { name: 'Black and gold', group: 'Neutral', primary: '#111111', accent: '#C9A227', background: '#FAFAF7', text: '#111111', soft: '#F0EEE6' },
  'graphite-orange': { name: 'Graphite and orange', group: 'Neutral', primary: '#2F3640', accent: '#F26B1D', background: '#FFFFFF', text: '#14181D', soft: '#F0F2F4' },
};

export const PALETTE_GROUPS = ['All', 'Fresh', 'Warm', 'Cool', 'Bold', 'Soft', 'Neutral'] as const;

export const FONT_PAIRS = {
  friendly: { name: 'Friendly', heading: 'Bricolage Grotesque', body: 'Figtree' },
  classic: { name: 'Classic', heading: 'Playfair Display', body: 'Source Sans 3' },
  modern: { name: 'Modern', heading: 'Space Grotesk', body: 'Inter' },
  warm: { name: 'Warm', heading: 'Fraunces', body: 'Nunito Sans' },
  editorial: { name: 'Editorial', heading: 'DM Serif Display', body: 'DM Sans' },
  clean: { name: 'Clean', heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans' },
  bold: { name: 'Bold', heading: 'Archivo Black', body: 'Work Sans' },
  elegant: { name: 'Elegant', heading: 'Cormorant Garamond', body: 'Montserrat' },
  playful: { name: 'Playful', heading: 'Poppins', body: 'Open Sans' },
  handmade: { name: 'Handmade', heading: 'Caveat', body: 'Lato' },
  traditional: { name: 'Traditional', heading: 'Lora', body: 'Merriweather' },
  techy: { name: 'Techy', heading: 'Outfit', body: 'Inter' },
} as const;

/** Legacy font tuples, kept for old published sites and tests. */
export const LEGACY_FONT_STACKS: Record<string, { heading: string; body: string }> = {
  friendly: { heading: "'Bricolage Grotesque', system-ui, sans-serif", body: "'Figtree', system-ui, sans-serif" },
  classic: { heading: "'Playfair Display', Georgia, serif", body: "'Source Sans 3', system-ui, sans-serif" },
  modern: { heading: "'Space Grotesk', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" },
  warm: { heading: "'Fraunces', Georgia, serif", body: "'Nunito Sans', system-ui, sans-serif" },
};

export function resolveThemeColors(theme: Theme): ThemeColors {
  if (theme.colors) return theme.colors;
  const palette = PALETTES[theme.palette ?? 'fresh-green'] ?? PALETTES['fresh-green'];
  return { primary: palette.primary, accent: palette.accent, background: palette.background, text: palette.text, soft: palette.soft };
}

export function resolveFonts(theme: Theme): { heading: string; body: string; headingFamily: string; bodyFamily: string } {
  if (theme.fonts) {
    const headingFamily = theme.fonts.heading.id;
    const bodyFamily = theme.fonts.body.id;
    return {
      headingFamily,
      bodyFamily,
      heading: `'${headingFamily}', system-ui, sans-serif`,
      body: `'${bodyFamily}', system-ui, sans-serif`,
    };
  }
  const pair = LEGACY_FONT_STACKS[theme.fontPair ?? 'friendly'] ?? LEGACY_FONT_STACKS.friendly;
  const meta = FONT_PAIRS[(theme.fontPair ?? 'friendly') as keyof typeof FONT_PAIRS] ?? FONT_PAIRS.friendly;
  return { heading: pair.heading, body: pair.body, headingFamily: meta.heading, bodyFamily: meta.body };
}

export function themeTokens(theme: Theme) {
  const colors = resolveThemeColors(theme);
  const fonts = resolveFonts(theme);
  const tokens = deriveTokens(colors, theme);
  const scale = theme.fonts?.scale ?? 'comfortable';
  const density = theme.density ?? 'comfortable';
  const type = {
    compact: { h1: '32px', h2: '24px', h3: '20px', body: '15px', small: '13px' },
    comfortable: { h1: '36px', h2: '28px', h3: '22px', body: '16px', small: '14px' },
    large: { h1: '40px', h2: '32px', h3: '24px', body: '17px', small: '15px' },
  }[scale];
  const spacing = {
    compact: { pad: '36px', gap: '12px' },
    comfortable: { pad: '48px', gap: '16px' },
    airy: { pad: '64px', gap: '20px' },
  }[density];
  return {
    ...tokens,
    '--s-font-heading': fonts.heading,
    '--s-font-body': fonts.body,
    '--s-h1': type.h1,
    '--s-h2': type.h2,
    '--s-h3': type.h3,
    '--s-body': type.body,
    '--s-small': type.small,
    '--s-pad-y': spacing.pad,
    '--s-gap': spacing.gap,
    '--s-field-bg': 'var(--s-card)',
    '--s-field-text': 'var(--s-text)',
    '--s-field-border': `color-mix(in srgb, ${colors.text} 32%, ${colors.background})`,
    '--s-placeholder': `color-mix(in srgb, ${colors.text} 52%, ${colors.background})`,
    '--s-focus-ring': `color-mix(in srgb, ${colors.primary} 35%, transparent)`,
  } as Record<string, string>;
}
