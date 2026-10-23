import { converter, formatHex, parse, wcagContrast } from 'culori';

export type RGB = { r: number; g: number; b: number };
export type HSV = { h: number; s: number; v: number };
export type OKLCH = { l: number; c: number; h: number };

const toRgb = converter('rgb');
const toOklch = converter('oklch');
const toHsv = converter('hsv');

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function normaliseHex(hex: string): string {
  const s = hex.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(s)) {
    const r = s[0], g = s[1], b = s[2];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9A-F]{6}$/.test(s)) return `#${s}`;
  throw new Error('Invalid hex');
}

export function hexToRgb(hex: string): RGB {
  const n = normaliseHex(hex);
  const v = parseInt(n.slice(1), 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

export function rgbToHex(rgb: RGB): string {
  const r = Math.round(clamp(rgb.r, 0, 1) * 255);
  const g = Math.round(clamp(rgb.g, 0, 1) * 255);
  const b = Math.round(clamp(rgb.b, 0, 1) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

export function hexToHsv(hex: string): HSV {
  const h = toHsv(hex);
  if (!h) return { h: 0, s: 0, v: 0 };
  return { h: 'h' in h ? (h.h as number) ?? 0 : 0, s: (h.s as number) ?? 0, v: (h.v as number) ?? 0 };
}

export function hsvToHex(hsv: HSV): string {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = clamp(hsv.s, 0, 1);
  const v = clamp(hsv.v, 0, 1);
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return rgbToHex({ r: r1 + m, g: g1 + m, b: b1 + m });
}

export function hexToOklch(hex: string): OKLCH {
  const o = toOklch(hex);
  if (!o) return { l: 0, c: 0, h: 0 };
  return { l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0 };
}

export function oklchToHex(oklch: OKLCH): string {
  const h = ((oklch.h % 360) + 360) % 360;
  const l = clamp(oklch.l, 0, 1);
  const c = Math.max(0, oklch.c);
  const hex = formatHex({ mode: 'oklch', l, c, h } as any);
  return normaliseHex(hex ?? '#000000');
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const f = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = f(rgb.r), g = f(rgb.g), b = f(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const lighter = Math.max(la, lb), darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function bestTextOn(bg: string): string {
  const cW = contrastRatio('#FFFFFF', bg);
  const cB = contrastRatio('#1F1A17', bg);
  return cW >= cB ? '#FFFFFF' : '#1F1A17';
}

export function adjustForContrast(fg: string, bg: string, target = 4.5): string {
  let ratio = contrastRatio(fg, bg);
  if (ratio >= target - 1e-6) return normaliseHex(fg);
  const o = hexToOklch(fg);
  const bgL = hexToOklch(bg).l;
  // try to move away
  if (o.l >= bgL) {
    // darken
    for (let l = o.l - 0.01; l >= 0; l -= 0.01) {
      const h = oklchToHex({ l, c: o.c, h: o.h });
      if (contrastRatio(h, bg) >= target) return h;
    }
  } else {
    for (let l = o.l + 0.01; l <= 1; l += 0.01) {
      const h = oklchToHex({ l, c: o.c, h: o.h });
      if (contrastRatio(h, bg) >= target) return h;
    }
  }
  // if impossible, return best
  return bestTextOn(bg);
}

export function mix(a: string, b: string, pct: number): string {
  const p = clamp(pct, 0, 1);
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return rgbToHex({ r: ra.r + (rb.r - ra.r) * p, g: ra.g + (rb.g - ra.g) * p, b: ra.b + (rb.b - ra.b) * p });
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.179;
}

export function describeColour(hex: string): string {
  const o = hexToOklch(hex);
  const h = ((o.h % 360) + 360) % 360;
  const l = o.l, c = o.c;
  if (l < 0.2) return 'Very dark';
  if (l > 0.9 && c < 0.02) return 'Very light';
  if (c < 0.03) {
    if (l > 0.8) return 'Light grey';
    if (l > 0.6) return 'Grey';
    if (l > 0.4) return 'Dark grey';
    return 'Charcoal';
  }
  if (h >= 0 && h < 15) return c > 0.12 ? 'Bright red' : l < 0.4 ? 'Dark red' : 'Red';
  if (h < 45) return c > 0.12 ? 'Bright orange' : 'Orange';
  if (h < 75) return c > 0.12 ? 'Bright yellow' : 'Yellow';
  if (h < 150) return c > 0.12 ? 'Bright green' : l > 0.6 ? 'Soft green' : 'Dark green';
  if (h < 210) return c > 0.12 ? 'Bright teal' : 'Teal';
  if (h < 255) return c > 0.12 ? 'Bright blue' : 'Blue';
  if (h < 290) return c > 0.12 ? 'Bright purple' : 'Purple';
  if (h < 330) return c > 0.12 ? 'Bright pink' : 'Pink';
  return c > 0.12 ? 'Bright red' : 'Red';
}

export function harmonies(primary: string) {
  const o = hexToOklch(primary);
  const h = o.h ?? 0;
  const accentAt = (d: number) => oklchToHex({ l: Math.min(0.8, Math.max(0.72, o.l + 0.1)), c: Math.max(0.12, o.c * 1.2), h: (h + d + 360) % 360 });
  return {
    complementary: accentAt(180),
    analogous: accentAt(30),
    triadic: accentAt(120),
    split: accentAt(150),
    monochrome: oklchToHex({ l: Math.min(0.8, o.l + 0.25), c: Math.max(0.08, o.c * 0.8), h }),
  };
}

export function deriveTokens(colors: { primary: string; accent: string; background: string; text: string; soft: string }, theme: any = {}) {
  const primary = normaliseHex(colors.primary);
  const accent = normaliseHex(colors.accent);
  const background = normaliseHex(colors.background);
  const text = normaliseHex(colors.text);
  const soft = normaliseHex(colors.soft);
  const pHover = (() => {
    const o = hexToOklch(primary);
    if (o.l < 0.35) return oklchToHex({ l: Math.min(1, o.l + 0.06), c: o.c, h: o.h });
    return oklchToHex({ l: Math.max(0, o.l - 0.06), c: o.c, h: o.h });
  })();
  const onPrimary = bestTextOn(primary);
  const onAccent = bestTextOn(accent);
  let link = adjustForContrast(primary, background, 4.5);
  // also ensure on soft
  if (contrastRatio(link, soft) < 4.5) {
    link = adjustForContrast(link, soft, 4.5);
  }
  let muted = adjustForContrast(mix(text, background, 0.32), background, 4.5);
  let card = luminance(background) > 0.88 ? '#FFFFFF' : mix(background, text, 0.08);
  if (isDark(background)) card = mix(background, '#FFFFFF', 0.06);
  const cardBorder = mix(text, card, 0.14);
  const border = mix(text, background, 0.14);
  const iconTile = contrastRatio(soft, background) < 1.1 ? mix(primary, card, 0.12) : soft;
  const shadow = isDark(background) ? '0 1px 2px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.18)' : '0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08)';
  const error = adjustForContrast('#B3261E', background, 4.5);
  const corners = theme.corners || 'soft';
  const radius = corners === 'sharp' ? '2px' : corners === 'round' ? '20px' : '12px';
  const radiusLg = corners === 'sharp' ? '4px' : corners === 'round' ? '28px' : '20px';
  const buttons = theme.buttons || {};
  let radiusBtn = radius;
  if (buttons.shape === 'square') radiusBtn = '2px';
  else if (buttons.shape === 'round') radiusBtn = '20px';
  else if (buttons.shape === 'pill') radiusBtn = '999px';
  else if (buttons.shape === 'soft') radiusBtn = '12px';
  return {
    '--s-primary': primary,
    '--s-accent': accent,
    '--s-bg': background,
    '--s-text': text,
    '--s-soft': soft,
    '--s-primary-hover': pHover,
    '--s-on-primary': onPrimary,
    '--s-on-accent': onAccent,
    '--s-link': link,
    '--s-muted': muted,
    '--s-card': card,
    '--s-card-border': cardBorder,
    '--s-border': border,
    '--s-icon-tile': iconTile,
    '--s-shadow': shadow,
    '--s-scrim': 'rgba(0,0,0,.28)',
    '--s-overlay': 'rgba(0,0,0,.5)',
    '--s-on-overlay': '#FFFFFF',
    '--s-error': error,
    '--s-radius': radius,
    '--s-radius-lg': radiusLg,
    '--s-radius-btn': radiusBtn,
  } as Record<string, string>;
}
