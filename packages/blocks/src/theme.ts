import type { Palette, Theme, ThemeColors } from "./types";

export const PALETTES: Record<Palette, ThemeColors> = {
  "fresh-green": {
    primary: "#0B6B4F",
    accent: "#F59E0B",
    background: "#FFFBF5",
    text: "#1F1A17",
    soft: "#F0F7F4",
    onPrimary: "#FFFFFF",
    muted: "#5C544E",
    border: "#E5DDD3",
  },
  ocean: {
    primary: "#0369A1",
    accent: "#06B6D4",
    background: "#F8FAFC",
    text: "#0F172A",
    soft: "#E0F2FE",
    onPrimary: "#FFFFFF",
    muted: "#475569",
    border: "#CBD5E1",
  },
  berry: {
    primary: "#9D174D",
    accent: "#F43F5E",
    background: "#FFF9FB",
    text: "#27141D",
    soft: "#FCE7F3",
    onPrimary: "#FFFFFF",
    muted: "#6B4354",
    border: "#F3D5E2",
  },
  sunset: {
    primary: "#C2410C",
    accent: "#F59E0B",
    background: "#FFFBF7",
    text: "#291810",
    soft: "#FFEDD5",
    onPrimary: "#FFFFFF",
    muted: "#6E4A36",
    border: "#F1D9C5",
  },
  midnight: {
    primary: "#1E3A8A",
    accent: "#38BDF8",
    background: "#F8FAFC",
    text: "#0F172A",
    soft: "#DBEAFE",
    onPrimary: "#FFFFFF",
    muted: "#475569",
    border: "#CBD5E1",
  },
  charcoal: {
    primary: "#1F2937",
    accent: "#10B981",
    background: "#FAFAFA",
    text: "#111827",
    soft: "#F3F4F6",
    onPrimary: "#FFFFFF",
    muted: "#4B5563",
    border: "#E5E7EB",
  },
  frame: {
    primary: "#111111",
    accent: "#B5A58A",
    background: "#F5F4F0",
    text: "#111111",
    soft: "#ECEAE3",
    onPrimary: "#F5F4F0",
    muted: "#59564E",
    border: "#D8D4C9",
  },
  meridian: {
    primary: "#0F1F3D",
    accent: "#B08D57",
    background: "#FAF8F3",
    text: "#0F1F3D",
    soft: "#EFECE3",
    onPrimary: "#FAF8F3",
    muted: "#3A4252",
    border: "#DCD5C5",
  },
  ember: {
    primary: "#B2462E",
    accent: "#C8553D",
    background: "#1E1A18",
    text: "#F6EBDD",
    soft: "#2A2421",
    onPrimary: "#FFF8F0",
    muted: "#D4C6B6",
    border: "#443A34",
  },
  concrete: {
    primary: "#0A0A0A",
    accent: "#FF4F00",
    background: "#D9D9D6",
    text: "#0A0A0A",
    soft: "#E7E7E4",
    onPrimary: "#FFFFFF",
    muted: "#333330",
    border: "#8F8F8A",
  },
  willow: {
    primary: "#2F3E36",
    accent: "#A8B5A0",
    background: "#EFE6DA",
    text: "#2F3E36",
    soft: "#E8CFC4",
    onPrimary: "#EFE6DA",
    muted: "#495A51",
    border: "#D6C9B8",
  },
  pulse: {
    primary: "#6847F5",
    accent: "#22D3EE",
    background: "#0B0D17",
    text: "#F5F7FF",
    soft: "#14182D",
    onPrimary: "#FFFFFF",
    muted: "#A1A7BC",
    border: "#262C4A",
  },
  clearview: {
    primary: "#1F8582",
    accent: "#2BA8A4",
    background: "#FFFFFF",
    text: "#1D3557",
    soft: "#E6F6F4",
    onPrimary: "#FFFFFF",
    muted: "#3D5575",
    border: "#CBE7E3",
  },
  bloom: {
    primary: "#9F2D3A",
    accent: "#D97706",
    background: "#FFFDF8",
    text: "#1E1716",
    soft: "#FAEDE8",
    onPrimary: "#FFFFFF",
    muted: "#5E4E4B",
    border: "#E8D8D1",
  },
  sprout: {
    primary: "#1F6E4D",
    accent: "#F59E0B",
    background: "#FFFCF3",
    text: "#1A2E23",
    soft: "#E7F5ED",
    onPrimary: "#FFFFFF",
    muted: "#425B4D",
    border: "#CFE4D8",
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
  { id: "statement", label: "Statement", description: "Full-width deep contrast statement block" },
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

const GOOGLE_FONT_SPECS: Record<string, string> = {
  Anton: "Anton:wght@400",
  "Baloo 2": "Baloo+2:wght@500;600;700",
  "Bodoni Moda": "Bodoni+Moda:ital,opsz,wght@0,6..96,500;0,6..96,700;1,6..96,500",
  "Bricolage Grotesque": "Bricolage+Grotesque:wght@500;600;700",
  "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400",
  "DM Serif Display": "DM+Serif+Display:ital@0;1",
  Figtree: "Figtree:wght@400;500;600;700",
  Fraunces: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700",
  "IBM Plex Mono": "IBM+Plex+Mono:wght@400;500;600",
  Inter: "Inter:wght@400;500;600;700",
  "JetBrains Mono": "JetBrains+Mono:wght@400;600;700",
  "Libre Baskerville": "Libre+Baskerville:wght@400;700",
  "Libre Caslon Text": "Libre+Caslon+Text:ital,wght@0,400;0,700;1,400",
  Lora: "Lora:wght@400;600;700",
  Manrope: "Manrope:wght@400;500;600;700",
  Montserrat: "Montserrat:wght@400;500;600;700",
  Nunito: "Nunito:wght@400;600;700",
  "Nunito Sans": "Nunito+Sans:wght@400;600;700",
  Oswald: "Oswald:wght@500;600;700",
  "Playfair Display": "Playfair+Display:wght@500;600;700",
  Poppins: "Poppins:wght@500;600;700",
  Quicksand: "Quicksand:wght@500;600;700",
  "Source Sans 3": "Source+Sans+3:wght@400;500;600;700",
  "Space Grotesk": "Space+Grotesk:wght@500;600;700",
};

export function themeGoogleFontsUrl(theme?: Theme | null): string | null {
  const candidates = [theme?.fonts?.heading?.id, theme?.fonts?.body?.id].filter(
    (name): name is string => typeof name === "string" && name.trim().length > 0,
  );
  const specs = Array.from(
    new Set(
      candidates
        .map((id) => GOOGLE_FONT_SPECS[id.trim()])
        .filter((spec): spec is string => Boolean(spec)),
    ),
  );
  if (specs.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${specs.map((spec) => `family=${spec}`).join("&")}&display=swap`;
}

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
    muted: custom.muted || base.muted || "#5C544E",
    border: custom.border || base.border || "#E5DDD3",
  };
}

export function themeTokens(theme?: Theme | null): Record<string, string> {
  const colors = resolveThemeColors(theme);
  const corners = theme?.corners ?? "soft";
  const radius = corners === "sharp" ? "0px" : corners === "round" ? "18px" : "8px";
  const buttonRadius =
    theme?.design?.buttonShape === "pill"
      ? "9999px"
      : theme?.design?.buttonShape === "square"
        ? "0px"
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
  const sectionPad = density === "compact" ? "44px" : density === "airy" ? "88px" : "64px";

  return {
    "--s-primary": colors.primary,
    "--s-accent": colors.accent,
    "--s-bg": colors.background,
    "--s-text": colors.text,
    "--s-soft": colors.soft,
    "--s-on-primary": colors.onPrimary ?? "#FFFFFF",
    "--s-muted": colors.muted ?? "#5C544E",
    "--s-border": colors.border ?? "#E5DDD3",
    "--s-radius": radius,
    "--s-btn-radius": buttonRadius,
    "--s-font-heading": headingFont,
    "--s-font-body": bodyFont,
    "--s-section-pad": sectionPad,
  };
}
