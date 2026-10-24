import type {
  BuildSiteInput,
  PublishImage,
  PublishPage,
  SiteSettings,
  SocialLink,
} from "@get-on/publisher";
import type { Theme } from "@get-on/blocks";

const PALETTES = new Set([
  "fresh-green",
  "ocean",
  "berry",
  "sunset",
  "midnight",
  "charcoal",
]);
const FONT_PAIRS = new Set(["friendly", "classic", "modern", "warm"]);
const CORNERS = new Set(["soft", "sharp", "round"]);

export type ProjectJson = {
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  hours?: string;
  businessType?: string;
  logoData?: string | null;
  socialLinks?: { network?: string; url?: string }[];
};

export type SourceProject = {
  id: string;
  name: string;
  subdomain: string;
  settings: unknown;
};

export type SourceSettings = {
  theme?: unknown;
  show_watermark?: boolean | null;
  seo_site_title?: string | null;
  seo_description?: string | null;
  seo_title_format?: string | null;
  social_image_url?: string | null;
  search_indexing?: boolean | null;
  tagline?: string | null;
  timezone?: string | null;
  theme_color?: string | null;
  twitter_handle?: string | null;
  address_parts?: unknown;
  verification?: unknown;
  maintenance?: unknown;
  custom_404?: unknown;
};

export type SourcePage = {
  id: string;
  title: string;
  path: string;
  position: number;
  is_homepage: boolean;
  blocks: unknown;
  show_in_menu?: boolean | null;
  is_hidden?: boolean | null;
  seo_title?: string | null;
  seo_description?: string | null;
  hide_from_search?: boolean | null;
};

export type SourceMedia = {
  id: string;
  path: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
};

export type BuildInputArgs = {
  project: SourceProject;
  projectSettings: SourceSettings | null;
  pages: SourcePage[];
  media: SourceMedia[];
  imageBytes: Map<string, Uint8Array>;
  planId: string;
  publishId: string;
  rootDomain?: string;
  /** The plugin ids that are switched on for the website. */
  activePlugins?: string[];
  builtAt?: Date;
};

function text(value: string | null | undefined): string | undefined {
  const clean = (value ?? "").trim();
  return clean ? clean : undefined;
}

const SCALES = new Set(["compact", "comfortable", "large"]);
const DENSITIES = new Set(["compact", "comfortable", "airy"]);
const BUTTON_SHAPES = new Set(["square", "soft", "round", "pill"]);
const BUTTON_STYLES = new Set(["solid", "outline", "soft"]);
const BUTTON_SIZES = new Set(["normal", "large"]);
const CARD_STYLES = new Set(["flat", "outlined", "shadow"]);
const COLOR_KEYS = ["primary", "accent", "background", "text", "soft"] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function colour(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : null;
}

function customNotFound(value: unknown): SiteSettings["customNotFound"] {
  const row = record(value);
  const title = text(typeof row.title === "string" ? row.title : undefined);
  const body = text(typeof row.text === "string" ? row.text : undefined);
  const button = text(typeof row.button === "string" ? row.button : undefined);
  if (!title && !body && !button) return null;
  return { title, text: body, button };
}

function fontChoice(value: unknown, fallback: { id: string; weight: number }) {
  const font = record(value);
  return {
    id: typeof font.id === "string" && font.id.trim() ? font.id.trim().slice(0, 80) : fallback.id,
    weight: typeof font.weight === "number" && font.weight >= 100 && font.weight <= 900
      ? Math.round(font.weight / 100) * 100
      : fallback.weight,
  };
}

export function parseTheme(value: unknown): Theme {
  const theme = record(value);

  const colors = record(theme.colors);
  const hasColors = COLOR_KEYS.every((key) => colour(colors[key]) !== null);
  if (theme.version === 2 || hasColors) {
    const fonts = record(theme.fonts);
    const buttons = record(theme.buttons);
    const cards = record(theme.cards);
    return {
      version: 2,
      colors: hasColors
        ? {
            primary: colour(colors.primary)!,
            accent: colour(colors.accent)!,
            background: colour(colors.background)!,
            text: colour(colors.text)!,
            soft: colour(colors.soft)!,
          }
        : {
            primary: "#0B6B4F",
            accent: "#F5A524",
            background: "#FFFBF5",
            text: "#1F1A17",
            soft: "#E8F5EF",
          },
      presetId: typeof theme.presetId === "string" ? theme.presetId : null,
      fonts: {
        heading: fontChoice(fonts.heading, { id: "Bricolage Grotesque", weight: 700 }),
        body: fontChoice(fonts.body, { id: "Figtree", weight: 400 }),
        scale: SCALES.has(String(fonts.scale))
          ? (fonts.scale as NonNullable<Theme["fonts"]>["scale"])
          : "comfortable",
      },
      buttons: {
        shape: BUTTON_SHAPES.has(String(buttons.shape))
          ? (buttons.shape as NonNullable<Theme["buttons"]>["shape"])
          : "soft",
        style: BUTTON_STYLES.has(String(buttons.style))
          ? (buttons.style as NonNullable<Theme["buttons"]>["style"])
          : "solid",
        size: BUTTON_SIZES.has(String(buttons.size))
          ? (buttons.size as NonNullable<Theme["buttons"]>["size"])
          : "normal",
        uppercase: buttons.uppercase === true,
        shadow: buttons.shadow === true,
      },
      cards: {
        style: CARD_STYLES.has(String(cards.style))
          ? (cards.style as NonNullable<Theme["cards"]>["style"])
          : "outlined",
      },
      corners: CORNERS.has(String(theme.corners))
        ? (theme.corners as Theme["corners"])
        : "soft",
      density: DENSITIES.has(String(theme.density))
        ? (theme.density as Theme["density"])
        : "comfortable",
      colorMode: "light",
    };
  }

  return {
    palette: PALETTES.has(String(theme.palette))
      ? (theme.palette as Theme["palette"])
      : "fresh-green",
    fontPair: FONT_PAIRS.has(String(theme.fontPair))
      ? (theme.fontPair as Theme["fontPair"])
      : "friendly",
    corners: CORNERS.has(String(theme.corners))
      ? (theme.corners as Theme["corners"])
      : "soft",
    colorMode: "light",
  };
}

/** Reads the small data URL made by the logo uploader. */
export function decodeDataUrl(
  value: string | null | undefined,
): { bytes: Uint8Array; contentType: string } | null {
  if (!value) return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(
    value,
  );
  if (!match) return null;
  try {
    const bytes = new Uint8Array(Buffer.from(match[2]!, "base64"));
    if (bytes.byteLength === 0 || bytes.byteLength > 2 * 1024 * 1024) return null;
    return { bytes, contentType: match[1]!.toLowerCase() };
  } catch {
    return null;
  }
}

/** Finds the pictures that the blocks of a website actually use. */
export function usedImageIds(pages: SourcePage[]): Set<string> {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "imageId" && typeof child === "string") {
        found.add(child);
      } else if (key === "imageIds" && Array.isArray(child)) {
        for (const id of child) {
          if (typeof id === "string") found.add(id);
        }
      } else {
        walk(child);
      }
    }
  };
  for (const page of pages) walk(page.blocks);
  return found;
}

function socialLinks(value: ProjectJson["socialLinks"]): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { network: string; url: string } =>
        Boolean(item && typeof item.url === "string" && item.url.trim()),
    )
    .map((item) => ({ network: item.network ?? "website", url: item.url.trim() }));
}

function slugOf(page: SourcePage): string {
  if (page.path === "/" || page.path === "") return "";
  return page.path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function toPublishPage(
  page: SourcePage,
  allowIndexing: boolean,
): PublishPage {
  return {
    id: page.id,
    slug: slugOf(page),
    title: page.title,
    description: null,
    seoTitle: text(page.seo_title),
    seoDescription: text(page.seo_description),
    noindex: Boolean(page.hide_from_search) || !allowIndexing,
    hidden: Boolean(page.is_hidden),
    showInMenu: page.show_in_menu !== false,
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
  };
}

/** Turns database rows into the input of the pure site builder. */
export function buildSiteInput(args: BuildInputArgs): BuildSiteInput {
  const projectJson = (
    args.project.settings && typeof args.project.settings === "object"
      ? args.project.settings
      : {}
  ) as ProjectJson;
  const settings = args.projectSettings ?? {};
  const allowIndexing = settings.search_indexing !== false;
  const contact = projectJson.contact ?? {};
  const decodedLogo = decodeDataUrl(projectJson.logoData);
  const theme = parseTheme(settings.theme);

  const images: PublishImage[] = [];
  for (const media of args.media) {
    const bytes = args.imageBytes.get(media.id);
    if (!bytes) continue;
    images.push({
      id: media.id,
      bytes,
      alt: media.alt ?? undefined,
      width: media.width ?? undefined,
      height: media.height ?? undefined,
      contentType: media.mime ?? undefined,
    });
  }

  const addressParts = record(settings.address_parts);
  const formattedAddress = [
    text(addressParts.street as string | undefined),
    text(addressParts.city as string | undefined),
    text(addressParts.region as string | undefined),
    text(addressParts.postal as string | undefined),
    text(addressParts.country as string | undefined),
  ]
    .filter(Boolean)
    .join(", ");

  const siteSettings: SiteSettings = {
    businessName: args.project.name,
    tagline: text(settings.tagline),
    locale: "en",
    theme,
    themeColor: colour(settings.theme_color),
    logo: decodedLogo
      ? {
          bytes: decodedLogo.bytes,
          contentType: decodedLogo.contentType,
        }
      : null,
    phone: text(contact.phone),
    email: text(contact.email),
    address: text(contact.address) ?? (formattedAddress || undefined),
    hours: text(projectJson.hours),
    businessType: text(projectJson.businessType),
    socialLinks: socialLinks(projectJson.socialLinks),
    seo: {
      title: text(settings.seo_site_title),
      description: text(settings.seo_description),
      titleFormat: text(settings.seo_title_format),
      twitterHandle: text(settings.twitter_handle),
      allowIndexing,
    },
    verification: record(settings.verification) as {
      gscTag?: string;
      bing?: string;
    },
    customNotFound: customNotFound(settings.custom_404),
    showWatermark: settings.show_watermark !== false,
    plan: args.planId,
  };

  const contactEnabled = (args.activePlugins ?? []).includes("contact");

  return {
    siteId: args.project.id,
    publishId: args.publishId,
    subdomain: args.project.subdomain,
    rootDomain: args.rootDomain,
    settings: siteSettings,
    pages: args.pages.map((page) => toPublishPage(page, allowIndexing)),
    forms: { enabled: contactEnabled },
    images,
    builtAt: args.builtAt ?? new Date(),
  };
}

/** The content snapshot stored with every publish, for future comparisons. */
export function buildSnapshot(
  project: SourceProject,
  settings: SourceSettings | null,
  pages: SourcePage[],
): Record<string, unknown> {
  return {
    project: { name: project.name, subdomain: project.subdomain },
    settings: settings ?? {},
    pages: pages.map((page) => ({
      id: page.id,
      title: page.title,
      path: page.path,
      position: page.position,
      is_homepage: page.is_homepage,
      show_in_menu: page.show_in_menu !== false,
      is_hidden: Boolean(page.is_hidden),
      blocks: page.blocks,
      seo_title: page.seo_title ?? null,
      seo_description: page.seo_description ?? null,
      hide_from_search: Boolean(page.hide_from_search),
    })),
  };
}
