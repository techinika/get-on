import type { Theme, Palette } from './types';

type PaletteColors = {
  primary: string;
  accent: string;
  bg: string;
  text: string;
  soft: string;
};

export const PALETTES: Record<Palette, PaletteColors & { name: string; dark?: Partial<PaletteColors> }> = {
  'fresh-green': {
    name: 'Fresh green',
    primary: '#0B6B4F',
    accent: '#F5A524',
    bg: '#FFFBF5',
    text: '#1F1A17',
    soft: '#E8F5EF',
    dark: {},
  },
  ocean: {
    name: 'Ocean',
    primary: '#1D5FA8',
    accent: '#F2994A',
    bg: '#F7FAFD',
    text: '#14202E',
    soft: '#E6F0FB',
    dark: {},
  },
  berry: {
    name: 'Berry',
    primary: '#A3265C',
    accent: '#F5B83D',
    bg: '#FFF8FA',
    text: '#2A1620',
    soft: '#FBE8F0',
    dark: {},
  },
  sunset: {
    name: 'Sunset',
    primary: '#D2541A',
    accent: '#1F7A6B',
    bg: '#FFF9F3',
    text: '#2B1A12',
    soft: '#FDEBDD',
    dark: {},
  },
  midnight: {
    name: 'Midnight',
    primary: '#3B3BA8',
    accent: '#F5C542',
    bg: '#F7F7FC',
    text: '#18182E',
    soft: '#E9E9F8',
    dark: {},
  },
  charcoal: {
    name: 'Charcoal',
    primary: '#1F2937',
    accent: '#E0A526',
    bg: '#FFFFFF',
    text: '#111827',
    soft: '#F1F3F5',
    dark: {},
  },
};

export const FONT_PAIRS = {
  friendly: { name: 'Friendly', heading: "'Bricolage Grotesque', system-ui, sans-serif", body: "'Figtree', system-ui, sans-serif" },
  classic: { name: 'Classic', heading: "'Playfair Display', Georgia, serif", body: "'Source Sans 3', system-ui, sans-serif" },
  modern: { name: 'Modern', heading: "'Space Grotesk', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" },
  warm: { name: 'Warm', heading: "'Fraunces', Georgia, serif", body: "'Nunito Sans', system-ui, sans-serif" },
} as const;

function getContrastRatio(c1: string, c2: string): number {
  const toRgb = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return [toLin(r), toLin(g), toLin(b)];
  };
  const [r1, g1, b1] = toRgb(c1);
  const [r2, g2, b2] = toRgb(c2);
  const l1 = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
  const l2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function themeTokens(theme: Theme) {
  const palette = PALETTES[theme.palette];
  const fonts = FONT_PAIRS[theme.fontPair];
  const onPrimary =
    getContrastRatio(palette.primary, '#FFFFFF') >= getContrastRatio(palette.primary, '#1F1A17')
      ? '#FFFFFF'
      : '#1F1A17';
  const corners =
    theme.corners === 'sharp'
      ? { '--s-radius': '2px', '--s-radius-lg': '4px', '--s-radius-btn': '2px' }
      : theme.corners === 'round'
        ? { '--s-radius': '20px', '--s-radius-lg': '28px', '--s-radius-btn': '999px' }
        : { '--s-radius': '12px', '--s-radius-lg': '20px', '--s-radius-btn': '12px' };

  return {
    '--s-primary': palette.primary,
    '--s-accent': palette.accent,
    '--s-bg': palette.bg,
    '--s-text': palette.text,
    '--s-soft': palette.soft,
    '--s-on-primary': onPrimary,
    '--s-border': `color-mix(in srgb, ${palette.text} 14%, ${palette.bg})`,
    '--s-font-heading': fonts.heading,
    '--s-font-body': fonts.body,
    '--s-card': '#FFFFFF',
    '--s-card-border': `color-mix(in srgb, ${palette.text} 14%, ${palette.bg})`,
    '--s-overlay': 'rgba(0,0,0,0.5)',
    '--s-on-overlay': '#FFFFFF',
    '--s-icon-tile': palette.soft,
    ...corners,
  } as Record<string, string>;
}
