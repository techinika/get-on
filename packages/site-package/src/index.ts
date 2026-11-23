import { createHash } from "node:crypto";

export const SITE_PACKAGE_FORMAT = "getonsite" as const;
export const SITE_PACKAGE_FORMAT_VERSION = 1 as const;
export const SITE_PACKAGE_CONTENT_SCHEMA_VERSION = 4 as const;
export const SITE_PACKAGE_THEME_VERSION = 1 as const;
export const MAX_CONTENT_BYTES = 10 * 1024 * 1024;

export class SitePackageError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "SitePackageError";
    this.code = code;
  }
}

export type SitePage = {
  pageKey: string;
  title: string;
  path: string;
  position: number;
  is_homepage: boolean;
  blocks: unknown[];
  show_in_menu: boolean;
  is_hidden: boolean;
  seo_title: string | null;
  seo_description: string | null;
  hide_from_search: boolean;
  social_image_url?: string | null;
};

export type SiteDocument = {
  profile: {
    name: string;
    address: string;
    [key: string]: unknown;
  };
  look: Record<string, unknown>;
  pages: SitePage[];
  sharedSections: unknown[];
  search: {
    title: string | null;
    description: string | null;
    titleFormat: string;
    indexing: boolean;
    twitterHandle: string | null;
    [key: string]: unknown;
  };
  redirects: Array<{
    from_path: string;
    to_type: string;
    to_value: string | null;
    code: number;
  }>;
  google: Record<string, unknown>;
  plugins: string[];
  customNotFound: Record<string, unknown>;
  templateOrigin: unknown;
};

export type SitePackageManifest = {
  format: typeof SITE_PACKAGE_FORMAT;
  formatVersion: typeof SITE_PACKAGE_FORMAT_VERSION;
  createdAt: string;
  createdWith?: string;
  kind: "export" | "backup" | "content" | string;
  contentSchemaVersion?: number;
  themeVersion?: number;
  source: {
    name: string;
    address: string;
  };
  options?: {
    pictures?: boolean;
    files?: boolean;
    messages?: boolean;
  };
  counts: {
    pages: number;
    redirects: number;
    pictures: number;
    messages: number;
  };
  contentHash: string;
  mediaTotalBytes?: number;
  checksums?: Record<string, string>;
};

export type SitePackageContent = {
  manifest?: SitePackageManifest;
  document: SiteDocument;
};

export function sha256Hex(
  input: Uint8Array | ArrayBuffer | string,
): string {
  const buf =
    typeof input === "string"
      ? Buffer.from(input, "utf8")
      : input instanceof Uint8Array
        ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
        : Buffer.from(input);
  return createHash("sha256").update(buf).digest("hex");
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stableSortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function contentHash(doc: unknown): string {
  return sha256Hex(JSON.stringify(stableSortValue(doc)));
}

export function checksumsFor(
  entries:
    | Array<{ path: string; bytes: Uint8Array | string }>
    | Record<string, Uint8Array | string>,
): string {
  const list = Array.isArray(entries)
    ? entries
    : Object.entries(entries).map(([p, bytes]) => ({ path: p, bytes }));
  return list
    .map((entry) => `${sha256Hex(entry.bytes)}  ${entry.path}`)
    .join("\n");
}

function normalizePages(rawPages: unknown[]): SitePage[] {
  return rawPages.map((raw, idx) => {
    const rec =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
      pageKey: String(rec.pageKey ?? rec.id ?? `page_${idx + 1}`),
      title: String(rec.title ?? "Page"),
      path: String(rec.path ?? "/"),
      position: typeof rec.position === "number" ? rec.position : idx,
      is_homepage: Boolean(rec.is_homepage ?? rec.isHomepage ?? idx === 0),
      blocks: Array.isArray(rec.blocks) ? rec.blocks : [],
      show_in_menu:
        rec.show_in_menu !== undefined
          ? Boolean(rec.show_in_menu)
          : rec.showInMenu !== false,
      is_hidden: Boolean(rec.is_hidden ?? rec.isHidden ?? false),
      seo_title: typeof rec.seo_title === "string"
        ? rec.seo_title
        : typeof rec.seoTitle === "string"
          ? rec.seoTitle
          : null,
      seo_description: typeof rec.seo_description === "string"
        ? rec.seo_description
        : typeof rec.seoDescription === "string"
          ? rec.seoDescription
          : null,
      hide_from_search: Boolean(rec.hide_from_search ?? rec.hideFromSearch ?? false),
      social_image_url:
        typeof rec.social_image_url === "string" ? rec.social_image_url : null,
    };
  });
}

export function parseContentBytes(
  bytes: Uint8Array | ArrayBuffer | string,
): SitePackageContent {
  const raw =
    typeof bytes === "string"
      ? new TextEncoder().encode(bytes)
      : bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes);

  if (raw.byteLength === 0) {
    throw new SitePackageError("EMPTY_FILE", "The uploaded package is empty.");
  }
  if (raw.byteLength > MAX_CONTENT_BYTES) {
    throw new SitePackageError("FILE_TOO_LARGE", "The package exceeds the maximum allowed size.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new SitePackageError("INVALID_JSON", "The package file is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SitePackageError("INVALID_PACKAGE", "The package root must be an object.");
  }

  const record = parsed as Record<string, unknown>;
  if (record.document && typeof record.document === "object") {
    const doc = record.document as Partial<SiteDocument>;
    const manifest =
      record.manifest && typeof record.manifest === "object"
        ? (record.manifest as SitePackageManifest)
        : undefined;
    if (manifest?.format && manifest.format !== SITE_PACKAGE_FORMAT && manifest.format !== "get-on-site-package") {
      throw new SitePackageError("UNSUPPORTED_FORMAT", `Unsupported format: ${String(manifest.format)}`);
    }
    const pages = Array.isArray(doc.pages) ? normalizePages(doc.pages) : [];
    if (pages.length === 0) {
      throw new SitePackageError("NO_PAGES", "The package does not contain any pages.");
    }
    return {
      manifest,
      document: {
        profile: doc.profile ?? { name: manifest?.source?.name ?? "", address: manifest?.source?.address ?? "" },
        look: doc.look ?? {},
        pages,
        sharedSections: Array.isArray(doc.sharedSections) ? doc.sharedSections : [],
        search: doc.search ?? {
          title: null,
          description: null,
          titleFormat: "{page} | {site}",
          indexing: true,
          twitterHandle: null,
        },
        redirects: Array.isArray(doc.redirects) ? doc.redirects : [],
        google: doc.google ?? {},
        plugins: Array.isArray(doc.plugins) ? doc.plugins : [],
        customNotFound: doc.customNotFound ?? {},
        templateOrigin: doc.templateOrigin ?? null,
      },
    };
  }

  if (record.format && record.format !== SITE_PACKAGE_FORMAT && record.format !== "get-on-site-package") {
    throw new SitePackageError("UNSUPPORTED_FORMAT", `Unsupported format: ${String(record.format)}`);
  }

  const rawPages = Array.isArray(record.pages) ? record.pages : [];
  if (rawPages.length === 0) {
    throw new SitePackageError("NO_PAGES", "The package does not contain any pages.");
  }

  const pages = normalizePages(rawPages);
  const project =
    record.project && typeof record.project === "object"
      ? (record.project as Record<string, unknown>)
      : {};
  const settings =
    record.settings && typeof record.settings === "object"
      ? (record.settings as Record<string, unknown>)
      : {};

  return {
    document: {
      profile: {
        name: String(project.name ?? ""),
        address: String(project.subdomain ?? ""),
      },
      look: (settings.theme as Record<string, unknown>) ?? {},
      pages,
      sharedSections: [],
      search: {
        title: null,
        description: null,
        titleFormat: "{page} | {site}",
        indexing: true,
        twitterHandle: null,
      },
      redirects: Array.isArray(record.redirects)
        ? (record.redirects as SiteDocument["redirects"])
        : [],
      google: {},
      plugins: [],
      customNotFound: {},
      templateOrigin: null,
    },
  };
}
