import type { FontPair, Palette, Theme, ThemeColors } from './types';
import { PALETTES } from './theme';

const LEGACY_PALETTES: Record<string, Palette> = {
  'fresh-green': 'fresh-green', ocean: 'ocean', berry: 'berry', sunset: 'sunset', midnight: 'midnight', charcoal: 'charcoal',
};

const LEGACY_FONT_PAIRS: Record<string, FontPair> = {
  friendly: 'friendly', classic: 'classic', modern: 'modern', warm: 'warm',
};

export function migrateTheme(raw: any): Theme {
  if (!raw || typeof raw !== 'object') {
    const palette = PALETTES['fresh-green']!;
    return {
      version: 2,
      colors: { primary: palette.primary, accent: palette.accent, background: palette.background, text: palette.text, soft: palette.soft },
      presetId: 'fresh-green',
      fonts: { heading: { id: 'bricolage-grotesque', weight: 700 }, body: { id: 'figtree', weight: 400 }, scale: 'comfortable' },
      buttons: { shape: 'soft', style: 'solid', size: 'normal', uppercase: false, shadow: false },
      cards: { style: 'outlined' },
      corners: 'soft',
      density: 'comfortable',
      colorMode: 'light',
    };
  }
  if (raw.version === 2 && raw.colors) {
    return { ...raw, colorMode: 'light' };
  }
  const palette = PALETTES[String(raw.palette)] ?? PALETTES['fresh-green']!;
  const colors: ThemeColors = { primary: palette.primary, accent: palette.accent, background: palette.background, text: palette.text, soft: palette.soft };
  const headingId = {
    friendly: 'bricolage-grotesque', classic: 'playfair-display', modern: 'space-grotesk', warm: 'fraunces',
  }[String(raw.fontPair)] ?? 'bricolage-grotesque';
  const bodyId = {
    friendly: 'figtree', classic: 'source-sans-3', modern: 'inter', warm: 'nunito-sans',
  }[String(raw.fontPair)] ?? 'figtree';
  const corners = raw.corners === 'sharp' ? 'sharp' : raw.corners === 'round' ? 'round' : 'soft';
  return {
    version: 2,
    colors,
    presetId: LEGACY_PALETTES[String(raw.palette)] ?? null,
    fonts: { heading: { id: headingId, weight: 700 }, body: { id: bodyId, weight: 400 }, scale: 'comfortable' },
    buttons: { shape: corners === 'soft' ? 'soft' : corners === 'round' ? 'pill' : 'square', style: 'solid', size: 'normal', uppercase: false, shadow: false },
    cards: { style: corners === 'soft' ? 'outlined' : 'flat' },
    corners,
    density: 'comfortable',
    colorMode: 'light',
  };
}

export { LEGACY_PALETTES, LEGACY_FONT_PAIRS };
