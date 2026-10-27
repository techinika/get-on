import { z } from "zod";
import { migrateTheme, validateContent } from "@get-on/blocks";
import {
  MAX_CONTENT_ARRAY_ITEMS,
  MAX_CONTENT_BYTES,
  MAX_CONTENT_DEPTH,
  MAX_CONTENT_STRING_LENGTH,
  SITE_PACKAGE_CONTENT_SCHEMA_VERSION,
  SITE_PACKAGE_FORMAT,
  SITE_PACKAGE_FORMAT_VERSION,
  SitePackageError,
  type SiteDocument,
  type SitePackageManifest,
  type SitePage,
} from "./format";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const safePath = z
  .string()
  .max(200)
  .refine(
    (value) =>
      value === "" ||
      (value.startsWith("/") &&
        !value.startsWith("//") &&
        !value.includes("..") &&
        !value.includes("\\") &&
        !/[?#\r\n]/.test(value)),
    { message: "Invalid page path" },
  );

const pageSchema = z
  .object({
    pageKey: z.string().min(1).max(80).optional(),
    id: z.string().min(1).max(80).optional(),
    title: z.string().min(1).max(200),
    path: safePath,
    position: z.number().int().min(0).max(100_000).default(0),
    is_homepage: z.boolean().default(false),
    blocks: z.array(z.unknown()).max(60).default([]),
    show_in_menu: z.boolean().default(true),
    is_hidden: z.boolean().default(false),
    seo_title: z.string().max(200).nullable().default(null),
    seo_description: z.string().max(500).nullable().default(null),
    hide_from_search: z.boolean().default(false),
    social_image_url: z.string().max(500).nullable().default(null),
  })
  .passthrough()
  .superRefine((page, ctx) => {
    if (!page.pageKey && !page.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Page key is required" });
    }
  });

const redirectSchema = z
  .object({
    from_path: z.string().min(1).max(200),
    to_type: z.enum(["page", "path", "url"]).default("path"),
    to_value: z.string().max(500).nullable().default(null),
    code: z.union([z.literal(301), z.literal(302)]).default(301),
  })
  .passthrough();

const documentSchema = z
  .object({
    profile: z.record(z.unknown()).default({}),
    look: z.record(z.unknown()).default({}),
    pages: z.array(pageSchema).min(1).max(20_000),
    sharedSections: z.array(z.unknown()).max(20_000).default([]),
    search: z.record(z.unknown()).default({}),
    redirects: z.array(redirectSchema).max(20_000).default([]),
    google: z.record(z.unknown()).default({}),
    plugins: z.array(z.string().min(1).max(80)).max(1_000).default([]),
    customNotFound: z.record(z.unknown()).default({}),
    templateOrigin: z.record(z.unknown()).nullable().default(null),
  })
  .strict();

const manifestSchema = z
  .object({
    format: z.literal(SITE_PACKAGE_FORMAT),
    formatVersion: z.number().int().positive(),
    createdAt: z.string().max(100),
    createdWith: z.string().max(100),
    kind: z.enum(["backup", "export", "site_zip"]),
    contentSchemaVersion: z.number().int().positive(),
    themeVersion: z.number().int().positive(),
    source: z.object({
      name: z.string().max(200),
      address: z.string().max(500),
    }),
    options: z.object({
      pictures: z.boolean(),
      files: z.boolean(),
      messages: z.boolean(),
    }),
    counts: z.record(z.number().int().nonnegative()),
    contentHash: z.string().max(128),
    mediaTotalBytes: z.number().int().nonnegative(),
  })
  .strict();

export type ParsedContentFile = {
  manifest: SitePackageManifest | null;
  document: SiteDocument;
};

/** Checks every string/key/array while the JSON is still untrusted. */
export function assertSafeJson(value: unknown, depth = 0): void {
  if (depth > MAX_CONTENT_DEPTH) {
    throw new SitePackageError("IMPORT_NOT_VALID", "The file is nested too deeply.");
  }
  if (typeof value === "string") {
    if (value.length > MAX_CONTENT_STRING_LENGTH) {
      throw new SitePackageError("IMPORT_NOT_VALID", "A text value in the file is too long.");
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_CONTENT_ARRAY_ITEMS) {
      throw new SitePackageError("IMPORT_NOT_VALID", "A list in the file is too long.");
    }
    for (const item of value) assertSafeJson(item, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new SitePackageError("IMPORT_NOT_VALID", "The file contains an unsafe key.");
      }
      if (key.length > MAX_CONTENT_STRING_LENGTH) {
        throw new SitePackageError("IMPORT_NOT_VALID", "A key in the file is too long.");
      }
      assertSafeJson(record[key], depth + 1);
    }
  }
}

export function validateManifest(input: unknown): SitePackageManifest {
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success) throw new SitePackageError("IMPORT_NOT_VALID");
  const manifest = parsed.data as SitePackageManifest;
  if (manifest.formatVersion > SITE_PACKAGE_FORMAT_VERSION) {
    throw new SitePackageError("IMPORT_TOO_NEW");
  }
  if (manifest.contentSchemaVersion > SITE_PACKAGE_CONTENT_SCHEMA_VERSION) {
    throw new SitePackageError("IMPORT_TOO_NEW");
  }
  return manifest;
}

function normalisePage(page: z.infer<typeof pageSchema>): SitePage {
  const validation = validateContent(page.blocks);
  if (!validation.ok) {
    throw new SitePackageError("IMPORT_NOT_VALID", "A page has content we cannot read.");
  }
  return {
    pageKey: page.pageKey ?? page.id!,
    title: page.title,
    path: page.path,
    position: page.position,
    is_homepage: page.is_homepage,
    blocks: validation.content.blocks,
    show_in_menu: page.show_in_menu,
    is_hidden: page.is_hidden,
    seo_title: page.seo_title,
    seo_description: page.seo_description,
    hide_from_search: page.hide_from_search,
    social_image_url: page.social_image_url,
  };
}

export function validateDocument(input: unknown): SiteDocument {
  assertSafeJson(input);
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) throw new SitePackageError("IMPORT_NOT_VALID");
  const raw = parsed.data;
  return {
    profile: raw.profile,
    look: migrateTheme(raw.look) as unknown as Record<string, unknown>,
    pages: raw.pages.map(normalisePage),
    sharedSections: raw.sharedSections,
    search: raw.search,
    redirects: raw.redirects as Array<Record<string, unknown>>,
    google: raw.google,
    plugins: [...new Set(raw.plugins)],
    customNotFound: raw.customNotFound,
    templateOrigin: raw.templateOrigin,
  };
}

export function parseContentBytes(bytes: Uint8Array): ParsedContentFile {
  if (bytes.byteLength > MAX_CONTENT_BYTES) {
    throw new SitePackageError("IMPORT_TOO_BIG");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new SitePackageError("IMPORT_NOT_VALID");
  }
  assertSafeJson(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SitePackageError("IMPORT_NOT_VALID");
  }
  const root = raw as Record<string, unknown>;
  const hasManifest = "manifest" in root;
  const manifest = hasManifest ? validateManifest(root.manifest) : null;
  const document = validateDocument(hasManifest ? root.document : root);
  return { manifest, document };
}

export function migrateContent(doc: unknown, _from: number): SiteDocument {
  return validateDocument(doc);
}
