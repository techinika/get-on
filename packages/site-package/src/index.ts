export const SITE_PACKAGE_FORMAT = "getonsite";
export const SITE_PACKAGE_FORMAT_VERSION = 1;
export const SITE_PACKAGE_CONTENT_SCHEMA_VERSION = 4;

export type SitePackageManifest = {
  format: "getonsite";
  formatVersion: number;
  createdAt: string;
  createdWith: string;
  kind: "backup" | "export";
  contentSchemaVersion: number;
  themeVersion: number;
  source: { name: string; address: string };
  options: { pictures: boolean; files: boolean; messages: boolean };
  counts: Record<string, number>;
  contentHash: string;
  mediaTotalBytes: number;
};

export type SiteDocument = {
  profile: Record<string, unknown>;
  look: Record<string, unknown>;
  pages: Array<Record<string, unknown>>;
  sharedSections: Array<Record<string, unknown>>;
  search: Record<string, unknown>;
  redirects: Array<Record<string, unknown>>;
  google: Record<string, unknown>;
  plugins: Array<Record<string, unknown>>;
  customNotFound: Record<string, unknown>;
  templateOrigin: Record<string, unknown> | null;
};

export function validateManifest(input: unknown): SitePackageManifest {
  if (!input || typeof input !== "object") throw new Error("IMPORT_NOT_VALID");
  const m = input as Record<string, unknown>;
  if (m.format !== SITE_PACKAGE_FORMAT) throw new Error("IMPORT_NOT_VALID");
  if (typeof m.formatVersion !== "number") throw new Error("IMPORT_NOT_VALID");
  if (m.formatVersion > SITE_PACKAGE_FORMAT_VERSION) throw new Error("IMPORT_TOO_NEW");
  return m as SitePackageManifest;
}

export function migrateContent(doc: SiteDocument, _from: number): SiteDocument {
  return doc;
}

export * from "./export";
