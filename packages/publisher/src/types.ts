import type { Theme } from "@get-on/blocks";

export type PublishPage = {
  id: string;
  /** The address part of the page, for example "about-us". The home page uses "". */
  slug: string;
  title: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  noindex?: boolean;
  hidden?: boolean;
  showInMenu?: boolean;
  blocks: unknown[];
};

export type PublishImage = {
  id: string;
  bytes: Uint8Array;
  alt?: string;
  width?: number;
  height?: number;
  contentType?: string;
};

export type PublishFont = {
  family: string;
  weight: number;
  style?: "normal" | "italic";
  bytes: Uint8Array;
};

export type PublishLogo = {
  bytes: Uint8Array;
  contentType?: string;
  width?: number;
  height?: number;
};

export type SocialLink = {
  network: string;
  url: string;
};

export type SiteSettings = {
  businessName: string;
  locale?: string;
  theme: Theme;
  logo?: PublishLogo | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  hours?: string | null;
  businessType?: string | null;
  socialLinks?: SocialLink[];
  seo?: {
    title?: string | null;
    description?: string | null;
    allowIndexing?: boolean;
  };
  showWatermark?: boolean;
  plan?: string;
};

export type BuildSiteInput = {
  siteId: string;
  publishId: string;
  subdomain: string;
  rootDomain?: string;
  settings: SiteSettings;
  pages: PublishPage[];
  images?: PublishImage[];
  fonts?: PublishFont[];
  /** The stylesheet of the renderer. Read from the package when it is missing. */
  css?: string;
  builtAt?: Date;
};

export type BuiltFile = {
  body: Uint8Array;
  contentType: string;
  size: number;
};

export type BuildSiteResult = {
  /** The files of this version. */
  files: Record<string, BuiltFile>;
  /** The files that every website can share, such as the fonts. */
  shared: Record<string, BuiltFile>;
  warnings: string[];
  /** The total size of all files, in bytes. */
  totalBytes: number;
  /** The size of the largest page, gzipped. */
  largestPageBytes: number;
};
