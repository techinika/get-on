import type { SiteSettings } from "./types";

export type PageSeo = {
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
  image?: string;
};

/** The title and description of one page. */
export function pageSeo(options: {
  settings: SiteSettings;
  pageTitle: string;
  pageDescription?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  noindex?: boolean;
  url: string;
  isHome?: boolean;
}): PageSeo {
  const siteTitle =
    options.settings.seo?.title?.trim() || options.settings.businessName;
  const pageTitle = options.pageTitle?.trim() || siteTitle;

  const title = options.seoTitle?.trim()
    ? options.seoTitle.trim()
    : options.isHome || pageTitle === siteTitle
      ? siteTitle
      : `${pageTitle} | ${siteTitle}`;

  const description =
    options.seoDescription?.trim() ||
    options.pageDescription?.trim() ||
    options.settings.seo?.description?.trim() ||
    "";

  return {
    title,
    description,
    canonical: options.url,
    noindex:
      Boolean(options.noindex) || options.settings.seo?.allowIndexing === false,
  };
}

/**
 * The structured data that tells Google about the business. It is the only
 * script on the page and it holds data only.
 */
export function localBusinessJsonLd(options: {
  settings: SiteSettings;
  url: string;
  image?: string;
}): Record<string, unknown> {
  const { settings } = options;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings.businessName,
    url: options.url,
  };

  if (settings.businessType) data["@type"] = "LocalBusiness";
  if (options.image) data.image = options.image;
  if (settings.phone) data.telephone = settings.phone;
  if (settings.email) data.email = settings.email;
  if (settings.address) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: settings.address,
    };
  }
  if (settings.hours) {
    data.openingHours = settings.hours;
  }
  if (settings.socialLinks?.length) {
    data.sameAs = settings.socialLinks.map((link) => link.url).filter(Boolean);
  }

  return data;
}

/** The page that Google reads for one page of the website. */
export function webPageJsonLd(options: {
  title: string;
  description: string;
  url: string;
  siteName: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: options.title,
    description: options.description,
    url: options.url,
    isPartOf: { "@type": "WebSite", name: options.siteName, url: options.url },
  };
}
