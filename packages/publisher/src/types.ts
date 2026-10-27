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
  tagline?: string | null;
  locale?: string;
  themeColor?: string | null;
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
    titleFormat?: string | null;
    twitterHandle?: string | null;
    allowIndexing?: boolean;
  };
  verification?: {
    gscTag?: string;
    bing?: string;
  } | null;
  customNotFound?: {
    title?: string | null;
    text?: string | null;
    button?: string | null;
  } | null;
  showWatermark?: boolean;
  plan?: string;
};

/**
 * The contact form details a published website needs. Present only when the
 * contact plugin is switched on for the website.
 */
export type PublishForm = {
  /** The form id, used in the posting address and the signed token. */
  id: string;
  /** The page the form lives on, for the "back" link. */
  pagePath: string;
  /** Where the thank-you page sends people, when different from the form page. */
  thankYouPagePath?: string | null;
};

export type PublishForms = {
  enabled: boolean;
  form?: PublishForm | null;
};

export type BuildSiteInput = {
  siteId: string;
  publishId: string;
  subdomain: string;
  rootDomain?: string;
  /** The custom main address, when one is live. */
  primaryHost?: string | null;
  settings: SiteSettings;
  pages: PublishPage[];
  images?: PublishImage[];
  fonts?: PublishFont[];
  /** The contact form details, when the contact plugin is on. */
  forms?: PublishForms;
  /** The stylesheet of the renderer. Read from the package when it is missing. */
  css?: string;
  builtAt?: Date;
};

/** What the build reports back so the app can record it. */
export type BuiltForm = {
  id: string;
  pagePath: string;
  showName: boolean;
  showPhone: boolean;
  phoneRequired: boolean;
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
  /** The forms found while building, so the app can store them. */
  forms: BuiltForm[];
  /** The exact renderer stylesheet used for this version. */
  rendererVersion: string;
  /** A short hash of the complete inline stylesheet. */
  cssHash: string;
  /** The size of the inline stylesheet, in bytes. */
  cssBytes: number;
};
