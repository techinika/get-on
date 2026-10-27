export const SITE_PACKAGE_FORMAT = "getonsite";
export const SITE_PACKAGE_FORMAT_VERSION = 1;
export const SITE_PACKAGE_CONTENT_SCHEMA_VERSION = 4;
export const SITE_PACKAGE_THEME_VERSION = 2;

export const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
export const MAX_CONTENT_DEPTH = 40;
export const MAX_CONTENT_ARRAY_ITEMS = 20_000;
export const MAX_CONTENT_STRING_LENGTH = 100_000;
export const MAX_ARCHIVE_ENTRIES = 2_000;
export const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export type PackageKind = "backup" | "export" | "site_zip";

export type SitePackageManifest = {
  format: "getonsite";
  formatVersion: number;
  createdAt: string;
  createdWith: string;
  kind: PackageKind;
  contentSchemaVersion: number;
  themeVersion: number;
  source: { name: string; address: string };
  options: { pictures: boolean; files: boolean; messages: boolean };
  counts: Record<string, number>;
  contentHash: string;
  mediaTotalBytes: number;
};

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
  social_image_url: string | null;
};

export type SiteDocument = {
  profile: Record<string, unknown>;
  look: Record<string, unknown>;
  pages: SitePage[];
  sharedSections: unknown[];
  search: Record<string, unknown>;
  redirects: Array<Record<string, unknown>>;
  google: Record<string, unknown>;
  plugins: string[];
  customNotFound: Record<string, unknown>;
  templateOrigin: Record<string, unknown> | null;
};

export class SitePackageError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}
