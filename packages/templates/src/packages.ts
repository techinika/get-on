import type { Block, Theme } from "@get-on/blocks";
import { TEMPLATE_CATALOG, type TemplateCatalogItem } from "./catalog";
import { heroImageIdForSlug, sharedTemplateImages } from "./images";

export type SampleProfile = {
  businessName: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  hoursNote: string;
  city: string;
  region: string;
  country: string;
  areaServed: string;
  social: Array<{ network: string; url: string }>;
};

export type BusinessProfileInput = Partial<{
  businessName: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  hoursNote: string;
  hours: string;
  city: string;
  region: string;
  country: string;
  areaServed: string;
  businessType: string;
  logo: unknown;
  social: Array<{ network: string; url: string }>;
}>;

export type TemplatePageDef = {
  key: string;
  id: string;
  title: string;
  path: string;
  isHome?: boolean;
  showInMenu?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  blocks: Block[];
};

export type TemplateComposition = {
  id: string;
  name: string;
  theme: Theme;
  pages: TemplatePageDef[];
};

export type SystemTemplatePackage = {
  schemaVersion: number;
  meta: {
    slug: string;
    name: string;
    tagline: string;
    description: string;
    category: string;
    tags: string[];
    businessTypes: string[];
    planMin: TemplateCatalogItem["planMin"];
    isDefault: boolean;
    featured: boolean;
  };
  sampleProfile: SampleProfile;
  assets: Array<{ id: string; role: string }>;
  compositions: TemplateComposition[];
};

export type TemplatePackage = SystemTemplatePackage;

export type MaterializedPage = {
  key: string;
  id: string;
  title: string;
  menuLabel: string;
  path: string;
  position: number;
  isHome: boolean;
  showInMenu: boolean;
  seoTitle: string;
  seoDescription: string;
  blocks: Block[];
};

function makeTemplatePages(
  slug: string,
  heroLayout: string,
  extraPage = false,
): TemplatePageDef[] {
  const heroImg = heroImageIdForSlug(slug);
  const shared = sharedTemplateImages();
  const basePages: TemplatePageDef[] = [
    {
      key: "home",
      id: `${slug}-home`,
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: `${slug}-hero-1`,
          type: "hero",
          props: {
            layout: heroLayout,
            eyebrow: "{{businessName}}",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: heroImg,
            buttonLabel: "Get in touch",
            buttonLink: { type: "anchor", anchor: "contact" },
          },
        },
        {
          id: `${slug}-features-1`,
          type: "features",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "What we focus on",
            items: [
              { title: "Personal attention", text: "Helpful guidance tailored to what you need." },
              { title: "Clear pricing", text: "Straightforward quotes with zero surprises." },
              { title: "Dependable craft", text: "Consistent quality from first call to finish." },
            ],
          },
        },
        {
          id: `${slug}-gallery-1`,
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "mosaic",
            heading: "Inside our work",
            images: shared.map((img) => ({ imageId: img.id, alt: img.alt })),
          },
        },
        {
          id: `${slug}-phone-1`,
          type: "text",
          includeIf: "phone",
          props: {
            heading: "Call our team",
            text: "Reach {{businessName}} directly on {{phone}} during {{hoursNote}}.",
          },
        },
        {
          id: `${slug}-cta-1`,
          type: "cta",
          props: {
            layout: "split",
            heading: "Ready to connect with {{businessName}}?",
            subheading: "{{description}}",
            buttonLabel: "Contact us",
            buttonLink: { type: "anchor", anchor: "contact" },
          },
        },
      ],
    },
    {
      key: "about",
      id: `${slug}-about`,
      title: "About",
      path: "/about",
      isHome: false,
      showInMenu: true,
      seoTitle: "About | {{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: `${slug}-about-text`,
          type: "text",
          props: {
            heading: "About {{businessName}}",
            text: "{{description}}",
          },
        },
        {
          id: `${slug}-faq-1`,
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Common questions",
            items: [
              { title: "How do we get started?", text: "Send us a note and we will reply promptly." },
              { title: "Where do you serve?", text: "We work with clients across {{areaServed}}." },
            ],
          },
        },
      ],
    },
    {
      key: "services",
      id: `${slug}-services`,
      title: "Services",
      path: "/services",
      isHome: false,
      showInMenu: true,
      seoTitle: "Services | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: `${slug}-services-features`,
          type: "features",
          sampleOnly: true,
          props: {
            layout: "bento",
            heading: "How {{businessName}} helps",
            items: [
              { title: "Core service", text: "Tailored planning and execution." },
              { title: "Ongoing care", text: "Long-term support whenever you need updates." },
            ],
          },
        },
      ],
    },
    {
      key: "contact",
      id: `${slug}-contact`,
      title: "Contact",
      path: "/contact",
      isHome: false,
      showInMenu: true,
      seoTitle: "Contact | {{businessName}}",
      seoDescription: "Get in touch with {{businessName}}",
      blocks: [
        {
          id: `${slug}-contact-details`,
          type: "text",
          includeIf: "address",
          props: {
            heading: "Visit us",
            text: "Find us at {{address}} in {{city}}.",
          },
        },
        {
          id: `${slug}-contact-form`,
          type: "contact-form",
          props: {
            heading: "Message {{businessName}}",
            showName: true,
            showPhone: false,
          },
          sec: { anchor: "contact" },
        },
      ],
    },
  ];

  if (extraPage) {
    basePages.splice(3, 0, {
      key: "pricing",
      id: `${slug}-pricing`,
      title: "Pricing",
      path: "/pricing",
      isHome: false,
      showInMenu: true,
      seoTitle: "Pricing | {{businessName}}",
      seoDescription: "Plans and packages at {{businessName}}",
      blocks: [
        {
          id: `${slug}-pricing-1`,
          type: "pricing",
          sampleOnly: true,
          props: {
            heading: "Simple options",
            items: [
              { title: "Standard", price: "$95", text: "Everything needed to begin." },
              { title: "Complete", price: "$195", text: "Priority support and full coverage." },
            ],
          },
        },
      ],
    });
  }

  return basePages;
}

const STARTER_COMPOSITIONS: TemplateComposition[] = [
  { id: "starter-1", name: "Warm Split", theme: { palette: "fresh-green", corners: "soft", fonts: { heading: { id: "Bricolage Grotesque", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "even" } }, pages: makeTemplatePages("starter", "split") },
  { id: "starter-2", name: "Ocean Center", theme: { palette: "ocean", corners: "soft", fonts: { heading: { id: "Manrope", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "alternate" } }, pages: makeTemplatePages("starter", "centered") },
  { id: "starter-3", name: "Berry Editorial", theme: { palette: "berry", corners: "round", fonts: { heading: { id: "Fraunces", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "tinted" } }, pages: makeTemplatePages("starter", "editorial") },
  { id: "starter-4", name: "Sunset Bold", theme: { palette: "sunset", corners: "soft", fonts: { heading: { id: "Space Grotesk", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "split" }, design: { rhythm: "bold" } }, pages: makeTemplatePages("starter", "fullbleed") },
  { id: "starter-5", name: "Midnight Clean", theme: { palette: "midnight", corners: "sharp", fonts: { heading: { id: "Lora", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "minimal" }, design: { rhythm: "even" } }, pages: makeTemplatePages("starter", "minimal") },
  { id: "starter-6", name: "Charcoal Serif", theme: { palette: "charcoal", corners: "soft", fonts: { heading: { id: "DM Serif Display", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "alternate" } }, pages: makeTemplatePages("starter", "arch") },
  { id: "starter-7", name: "Green Baskerville", theme: { palette: "fresh-green", corners: "soft", fonts: { heading: { id: "Libre Baskerville", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "tinted" } }, pages: makeTemplatePages("starter", "offset-frame") },
  { id: "starter-8", name: "Studio Oswald", theme: { palette: "sunset", corners: "sharp", fonts: { heading: { id: "Oswald", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "bold" } }, pages: makeTemplatePages("starter", "diagonal") },
  { id: "starter-9", name: "Elegant Cormorant", theme: { palette: "berry", corners: "round", fonts: { heading: { id: "Cormorant Garamond", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "alternate" } }, pages: makeTemplatePages("starter", "card-over-image") },
  { id: "starter-10", name: "Tech Mono", theme: { palette: "charcoal", corners: "sharp", fonts: { heading: { id: "JetBrains Mono", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "minimal" }, design: { rhythm: "even" } }, pages: makeTemplatePages("starter", "product-shot") },
];

type TemplateSpec = {
  slug: string;
  hero: string;
  header: string;
  font: string;
  rhythm: "even" | "alternate" | "tinted" | "bold";
  palette: string;
  extraPage?: boolean;
  sampleName: string;
  businessTypes: string[];
};

const TEMPLATE_SPECS: TemplateSpec[] = [
  { slug: "starter", hero: "split", header: "classic", font: "Bricolage Grotesque", rhythm: "even", palette: "fresh-green", sampleName: "Cedarbrook Neighbourhood Sample", businessTypes: ["local business", "consultant", "general"] },
  { slug: "software-company", hero: "product-shot", header: "classic", font: "Manrope", rhythm: "bold", palette: "ocean", extraPage: true, sampleName: "Northwind Telemetry Sample", businessTypes: ["software", "saas"] },
  { slug: "law-firm", hero: "arch", header: "centered", font: "Libre Baskerville", rhythm: "tinted", palette: "midnight", sampleName: "Alder & Associates Chambers", businessTypes: ["law firm", "legal", "accounting"] },
  { slug: "restaurant", hero: "fullbleed", header: "overlay", font: "DM Serif Display", rhythm: "alternate", palette: "berry", sampleName: "Saffron Copper Hearth Bistro", businessTypes: ["restaurant", "cafe", "bakery"] },
  { slug: "developer-portfolio", hero: "minimal", header: "minimal", font: "JetBrains Mono", rhythm: "even", palette: "charcoal", sampleName: "Kieran Vale Engineering", businessTypes: ["portfolio", "developer"] },
  { slug: "salon-beauty", hero: "offset-frame", header: "centered", font: "Cormorant Garamond", rhythm: "alternate", palette: "berry", sampleName: "Camellia Botanical Lounge", businessTypes: ["salon", "beauty", "spa"] },
  { slug: "boutique-shop", hero: "card-over-image", header: "split", font: "Fraunces", rhythm: "tinted", palette: "sunset", sampleName: "Loom & Clay Curated Goods", businessTypes: ["shop", "retail", "boutique"] },
  { slug: "home-services", hero: "diagonal", header: "classic", font: "Oswald", rhythm: "bold", palette: "fresh-green", sampleName: "Oakridge Plumbing & Heating", businessTypes: ["home services", "plumbing", "repair"] },
  { slug: "community-church", hero: "centered", header: "classic", font: "Lora", rhythm: "alternate", palette: "ocean", sampleName: "Meadowbrook Community Fellowship", businessTypes: ["church", "nonprofit", "community"] },
  { slug: "creative-studio", hero: "editorial", header: "classic", font: "Space Grotesk", rhythm: "even", palette: "charcoal", extraPage: true, sampleName: "Paperkite Visual Direction", businessTypes: ["creative studio", "agency", "photography"] },
];

export const SYSTEM_TEMPLATES: SystemTemplatePackage[] = TEMPLATE_SPECS.map((spec) => {
  const catalog = TEMPLATE_CATALOG.find((c) => c.slug === spec.slug)!;
  const heroId = heroImageIdForSlug(spec.slug);
  return {
    schemaVersion: 1,
    meta: {
      slug: spec.slug,
      name: catalog.name,
      tagline: catalog.tagline,
      description: catalog.description,
      category: catalog.category,
      tags: [catalog.category, spec.hero, spec.font.toLowerCase()],
      businessTypes: spec.businessTypes,
      planMin: catalog.planMin,
      isDefault: spec.slug === "starter",
      featured: catalog.featured,
    },
    sampleProfile: {
      businessName: spec.sampleName,
      tagline: `${spec.sampleName} serving our neighbourhood with care`,
      description: `${spec.sampleName} delivers dependable service built around practical local needs.`,
      phone: "+1 555 019 4820",
      email: `hello@${spec.slug.replace(/[^a-z0-9]/g, "")}.example`,
      address: "742 Evergreen Sample Terrace, Suite 4B",
      hoursNote: "Mon-Sat 8:30am-6:00pm",
      city: "Sampleton",
      region: "Highland Province",
      country: "Sampleland",
      areaServed: "Greater Sampleton Metro",
      social: [{ network: "instagram", url: `https://instagram.com/${spec.slug}` }],
    },
    assets: [{ id: heroId, role: "hero" }],
    compositions:
      spec.slug === "starter"
        ? STARTER_COMPOSITIONS
        : [
            {
              id: `${spec.slug}-1`,
              name: catalog.name,
              theme: {
                palette: spec.palette,
                corners: "soft",
                fonts: {
                  heading: { id: spec.font, weight: 700 },
                  body: { id: "Inter", weight: 400 },
                  scale: "comfortable",
                },
                header: { style: spec.header },
                design: { rhythm: spec.rhythm },
              },
              pages: makeTemplatePages(spec.slug, spec.hero, spec.extraPage),
            },
          ],
  };
});

export function requireSystemTemplate(slug: string): SystemTemplatePackage {
  const hit =
    SYSTEM_TEMPLATES.find((pkg) => pkg.meta.slug === slug) ??
    SYSTEM_TEMPLATES.find((pkg) => pkg.meta.isDefault) ??
    SYSTEM_TEMPLATES[0];
  if (!hit) throw new Error(`SYSTEM_TEMPLATE_NOT_FOUND:${slug}`);
  return hit;
}

export function validateTemplatePackage(pkg: SystemTemplatePackage): {
  ok: boolean;
  issues: Array<{ path: string; message: string }>;
} {
  const issues: Array<{ path: string; message: string }> = [];
  if (!pkg?.meta?.slug) issues.push({ path: "meta.slug", message: "Missing slug" });
  if (!pkg?.compositions?.length) issues.push({ path: "compositions", message: "Missing compositions" });
  for (const comp of pkg?.compositions ?? []) {
    if (!comp.pages?.length) {
      issues.push({ path: `compositions.${comp.id}.pages`, message: "Composition has no pages" });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function packageSummary(pkg: SystemTemplatePackage): {
  pageCount: number;
  blockCount: number;
  requiredPlugins: string[];
} {
  const comp = pkg.compositions[0];
  const pages = comp?.pages ?? [];
  const blocks = pages.flatMap((p) => p.blocks);
  const plugins = new Set<string>();
  for (const b of blocks) {
    if (b.type === "contact-form") plugins.add("contact");
  }
  return {
    pageCount: pages.length,
    blockCount: blocks.length,
    requiredPlugins: [...plugins],
  };
}

function hasField(profile: BusinessProfileInput, key: string): boolean {
  switch (key) {
    case "phone":
      return Boolean(profile.phone?.trim());
    case "email":
      return Boolean(profile.email?.trim());
    case "address":
      return Boolean(profile.address?.trim());
    case "hours":
      return Boolean(profile.hoursNote?.trim() || profile.hours?.trim());
    case "social":
      return Boolean(profile.social && profile.social.length > 0);
    case "logo":
      return Boolean(profile.logo);
    case "description":
      return Boolean(profile.description?.trim());
    case "tagline":
      return Boolean(profile.tagline?.trim());
    case "city":
      return Boolean(profile.city?.trim());
    case "areaServed":
      return Boolean(profile.areaServed?.trim());
    default:
      return true;
  }
}

function interpolateValue(
  value: unknown,
  tokens: Record<string, string>,
): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => tokens[key] ?? "");
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, tokens));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = interpolateValue(v, tokens);
    }
    return out;
  }
  return value;
}

export function materializeTemplate(
  pkg: SystemTemplatePackage,
  options: {
    profile: BusinessProfileInput;
    maxPages?: number | null;
    compositionId?: string;
    allowSampleContent?: boolean;
    imageSeed?: string;
  },
): {
  slug: string;
  name: string;
  theme: Theme;
  pages: MaterializedPage[];
  warnings: string[];
} {
  const comp =
    (options.compositionId
      ? pkg.compositions.find((c) => c.id === options.compositionId)
      : undefined) ?? pkg.compositions[0]!;

  const p = options.profile;
  const fallbackName = p.businessName?.trim() || pkg.sampleProfile.businessName;
  const tokens: Record<string, string> = {
    businessName: fallbackName,
    tagline: p.tagline?.trim() || (options.allowSampleContent ? pkg.sampleProfile.tagline : `Welcome to ${fallbackName}`),
    description: p.description?.trim() || (options.allowSampleContent ? pkg.sampleProfile.description : `${fallbackName} is ready to help you.`),
    phone: p.phone?.trim() || (options.allowSampleContent ? pkg.sampleProfile.phone : ""),
    email: p.email?.trim() || (options.allowSampleContent ? pkg.sampleProfile.email : ""),
    address: p.address?.trim() || (options.allowSampleContent ? pkg.sampleProfile.address : ""),
    hoursNote: p.hoursNote?.trim() || p.hours?.trim() || (options.allowSampleContent ? pkg.sampleProfile.hoursNote : ""),
    city: p.city?.trim() || (options.allowSampleContent ? pkg.sampleProfile.city : ""),
    region: p.region?.trim() || (options.allowSampleContent ? pkg.sampleProfile.region : ""),
    country: p.country?.trim() || (options.allowSampleContent ? pkg.sampleProfile.country : ""),
    areaServed: p.areaServed?.trim() || (options.allowSampleContent ? pkg.sampleProfile.areaServed : "your area"),
  };

  let pages = comp.pages.map((page, index): MaterializedPage => {
    const filteredBlocks = page.blocks
      .filter((block) => {
        if (!block.includeIf || options.allowSampleContent) return true;
        return hasField(p, block.includeIf);
      })
      .map((block) => interpolateValue(structuredClone(block), tokens) as Block);
    const renderedTitle = String(interpolateValue(page.title, tokens));

    return {
      key: page.key,
      id: page.id,
      title: renderedTitle,
      menuLabel: renderedTitle,
      path: page.path,
      position: index,
      isHome: Boolean(page.isHome || page.path === "/"),
      showInMenu: page.showInMenu !== false,
      seoTitle: String(interpolateValue(page.seoTitle ?? page.title, tokens)),
      seoDescription: String(interpolateValue(page.seoDescription ?? "", tokens)),
      blocks: filteredBlocks,
    };
  });

  if (typeof options.maxPages === "number" && options.maxPages > 0 && pages.length > options.maxPages) {
    const home = pages.find((pg) => pg.isHome) ?? pages[0]!;
    const others = pages.filter((pg) => pg !== home).slice(0, options.maxPages - 1);
    pages = [home, ...others];
  }

  return {
    slug: pkg.meta.slug,
    name: pkg.meta.name,
    theme: structuredClone(comp.theme),
    pages,
    warnings: [],
  };
}

export function scanSampleLeaks(
  blocks: Block[] | unknown[],
  sample: SampleProfile,
): string[] {
  const serialized = JSON.stringify(blocks).toLowerCase();
  const candidates = [
    sample.businessName,
    sample.phone,
    sample.email,
    sample.address,
    sample.city,
  ].filter((v) => Boolean(v && v.trim().length > 3));

  const leaks: string[] = [];
  for (const needle of candidates) {
    if (serialized.includes(needle.toLowerCase())) {
      leaks.push(needle);
    }
  }
  return leaks;
}

export function withDefaultImages(blocks: Block[], seed = "default"): Block[] {
  const shared = sharedTemplateImages();
  let offset = seed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return blocks.map((block) => {
    const props = { ...(block.props ?? {}) };
    if ((block.type === "hero" || block.type === "image") && !props.imageId) {
      const picked = shared[offset % shared.length]!;
      offset += 1;
      props.imageId = picked.id;
    }
    return { ...block, props };
  });
}
