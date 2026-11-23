import type { Palette, Theme, ThemeColors } from "./types";

export const PALETTES: Record<Palette, ThemeColors> = {
  "fresh-green": {
    primary: "#0B6B4F",
    accent: "#F59E0B",
    background: "#FFFBF5",
    text: "#1F1A17",
    soft: "#F0F7F4",
    onPrimary: "#FFFFFF",
  },
  ocean: {
    primary: "#0369A1",
    accent: "#06B6D4",
    background: "#F8FAFC",
    text: "#0F172A",
    soft: "#E0F2FE",
    onPrimary: "#FFFFFF",
  },
  berry: {
    primary: "#9D174D",
    accent: "#F43F5E",
    background: "#FFF9FB",
    text: "#27141D",
    soft: "#FCE7F3",
    onPrimary: "#FFFFFF",
  },
  sunset: {
    primary: "#C2410C",
    accent: "#F59E0B",
    background: "#FFFBF7",
    text: "#291810",
    soft: "#FFEDD5",
    onPrimary: "#FFFFFF",
  },
  midnight: {
    primary: "#1E3A8A",
    accent: "#38BDF8",
    background: "#F8FAFC",
    text: "#0F172A",
    soft: "#DBEAFE",
    onPrimary: "#FFFFFF",
  },
  charcoal: {
    primary: "#1F2937",
    accent: "#10B981",
    background: "#FAFAFA",
    text: "#111827",
    soft: "#F3F4F6",
    onPrimary: "#FFFFFF",
  },
};

export const HERO_LAYOUTS = [
  { id: "split", label: "Split", description: "Headline left, image right" },
  { id: "centered", label: "Centered", description: "Centered copy above visual" },
  { id: "fullbleed", label: "Full bleed", description: "Full-width image backdrop" },
  { id: "editorial", label: "Editorial", description: "Magazine headline focus" },
  { id: "minimal", label: "Minimal", description: "Clean typographic intro" },
  { id: "product-shot", label: "Product shot", description: "Showcase UI or product card" },
  { id: "arch", label: "Arch frame", description: "Classic arched portrait frame" },
  { id: "offset-frame", label: "Offset frame", description: "Layered offset image frame" },
  { id: "card-over-image", label: "Card over image", description: "Floating card over hero image" },
  { id: "diagonal", label: "Diagonal", description: "Angled split visual banner" },
] as const;

export const DESIGN_OPTIONS = {
  density: [
    { id: "compact", label: "Compact" },
    { id: "comfortable", label: "Comfortable" },
    { id: "airy", label: "Airy" },
  ],
  corners: [
    { id: "sharp", label: "Sharp" },
    { id: "soft", label: "Soft" },
    { id: "round", label: "Round" },
  ],
  buttons: [
    { id: "square", label: "Square" },
    { id: "soft", label: "Soft" },
    { id: "round", label: "Round" },
    { id: "pill", label: "Pill" },
  ],
  rhythm: [
    { id: "even", label: "Even" },
    { id: "alternate", label: "Alternate" },
    { id: "tinted", label: "Tinted" },
    { id: "bold", label: "Bold" },
  ],
} as const;

export const THEME_TOKENS = [
  "primary",
  "accent",
  "bg",
  "text",
  "soft",
  "on-primary",
  "muted",
  "border",
] as const;

export function resolveThemeColors(theme?: Theme | null): ThemeColors {
  const paletteKey = (theme?.palette && theme.palette in PALETTES
    ? theme.palette
    : "fresh-green") as Palette;
  const base = PALETTES[paletteKey];
  const custom = theme?.colors ?? {};
  return {
    primary: custom.primary || base.primary,
    accent: custom.accent || base.accent,
    background: custom.background || base.background,
    text: custom.text || base.text,
    soft: custom.soft || base.soft,
    onPrimary: custom.onPrimary || base.onPrimary || "#FFFFFF",
  };
}

export function themeTokens(theme?: Theme | null): Record<string, string> {
  const colors = resolveThemeColors(theme);
  const corners = theme?.corners ?? "soft";
  const radius = corners === "sharp" ? "2px" : corners === "round" ? "16px" : "8px";
  const buttonRadius =
    theme?.design?.buttonShape === "pill"
      ? "9999px"
      : theme?.design?.buttonShape === "square"
        ? "2px"
        : theme?.design?.buttonShape === "round"
          ? "12px"
          : radius;
  const headingFont = theme?.fonts?.heading?.id
    ? `'${theme.fonts.heading.id}', system-ui, sans-serif`
    : `'Plus Jakarta Sans', system-ui, sans-serif`;
  const bodyFont = theme?.fonts?.body?.id
    ? `'${theme.fonts.body.id}', system-ui, sans-serif`
    : `'Figtree', system-ui, sans-serif`;
  const density = theme?.density ?? "comfortable";
  const sectionPad = density === "compact" ? "40px" : density === "airy" ? "84px" : "60px";

  return {
    "--s-primary": colors.primary,
    "--s-accent": colors.accent,
    "--s-bg": colors.background,
    "--s-text": colors.text,
    "--s-soft": colors.soft,
    "--s-on-primary": colors.onPrimary ?? "#FFFFFF",
    "--s-muted": "#5C544E",
    "--s-border": "#E5DDD3",
    "--s-radius": radius,
    "--s-btn-radius": buttonRadius,
    "--s-font-heading": headingFont,
    "--s-font-body": bodyFont,
    "--s-section-pad": sectionPad,
  };
}
