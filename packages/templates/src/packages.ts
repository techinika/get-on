import type { Block, Theme } from "@get-on/blocks";
import { TEMPLATE_CATALOG, type TemplateCatalogItem } from "./catalog";
import { heroImageIdForSlug, imagesForSlug, sharedTemplateImages } from "./images";

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

function contactTailPage(slug: string, heading: string, showPhone = true, tone?: "accent"): TemplatePageDef {
  return {
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
          heading: "Where to find us",
          text: "Visit {{businessName}} at {{address}} in {{city}}.",
        },
      },
      {
        id: `${slug}-contact-hours`,
        type: "text",
        includeIf: "hours",
        props: {
          heading: "Opening hours",
          text: "Available {{hoursNote}}.",
        },
      },
      {
        id: `${slug}-contact-form`,
        type: "contact-form",
        props: {
          heading,
          showName: true,
          showPhone,
          ...(tone ? { tone } : {}),
        },
        sec: { anchor: "contact" },
      },
    ],
  };
}

function buildStarterCompositionPages(
  id: string,
  heroLayout: string,
  secondaryBlock: "features" | "stats" | "testimonials" | "pricing" | "menu" | "before-after",
  gridLayout: "rows" | "bento" | "mosaic" | "alternating" | "compact" | "menu-list",
): TemplatePageDef[] {
  const imgs = imagesForSlug("starter");
  const shared = sharedTemplateImages();

  const homeMiddleBlock: Block =
    secondaryBlock === "stats"
      ? {
          id: `${id}-stats-1`,
          type: "stats",
          sampleOnly: true,
          props: {
            layout: gridLayout,
            heading: "By the numbers",
            items: [
              { value: "400+", title: "Local clients", text: "Projects delivered on schedule." },
              { value: "4.9/5", title: "Client rating", text: "Verified local feedback." },
              { value: "Same week", title: "Turnaround", text: "Clear availability and response." },
            ],
          },
        }
      : secondaryBlock === "testimonials"
        ? {
            id: `${id}-testimonials-1`,
            type: "testimonials",
            sampleOnly: true,
            props: {
              layout: gridLayout,
              heading: "Kind words from regulars",
              items: [
                { quote: "Warm service and thoughtful communication from day one.", author: "Amara K." },
                { quote: "Transparent scope and delivered earlier than promised.", author: "Daniel R." },
              ],
            },
          }
        : secondaryBlock === "pricing"
          ? {
              id: `${id}-pricing-1`,
              type: "pricing",
              sampleOnly: true,
              props: {
                layout: gridLayout,
                heading: "Straightforward packages",
                items: [
                  { title: "Starter consultation", price: "$95", text: "Focused planning session and written checklist." },
                  { title: "Full engagement", price: "$240", text: "End-to-end delivery with follow-up care." },
                ],
              },
            }
          : secondaryBlock === "menu"
            ? {
                id: `${id}-menu-1`,
                type: "menu",
                sampleOnly: true,
                props: {
                  layout: gridLayout,
                  heading: "Featured offerings",
                  items: [
                    { title: "Signature package", price: "$120", text: "Most popular choice for new clients." },
                    { title: "Seasonal review", price: "$75", text: "Quick refresh tailored to current goals." },
                    { title: "Priority booking", price: "$180", text: "Dedicated slot with fast delivery." },
                  ],
                },
              }
            : secondaryBlock === "before-after"
              ? {
                  id: `${id}-ba-1`,
                  type: "before-after",
                  sampleOnly: true,
                  props: {
                    layout: gridLayout,
                    heading: "Recent results",
                    items: [
                      { title: "Workspace refresh", text: "Streamlined layout and faster customer flow." },
                      { title: "Storefront upgrade", text: "Cleaner presentation and clearer signage." },
                    ],
                  },
                }
              : {
                  id: `${id}-features-1`,
                  type: "features",
                  sampleOnly: true,
                  props: {
                    layout: gridLayout,
                    heading: "Why locals choose {{businessName}}",
                    items: [
                      { title: "Personal attention", text: "Guidance tailored to your exact priorities." },
                      { title: "Clear pricing", text: "Straightforward quotes with zero hidden fees." },
                      { title: "Dependable craft", text: "Consistent quality from first call to finish." },
                    ],
                  },
                };

  return [
    {
      key: "home",
      id: `${id}-home`,
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: `${id}-hero-1`,
          type: "hero",
          props: {
            layout: heroLayout,
            eyebrow: "{{businessName}}",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Get in touch",
            buttonLink: { type: "url", url: "/contact" },
            button2Label: "Our story",
            button2Link: { type: "url", url: "/about" },
          },
        },
        homeMiddleBlock,
        {
          id: `${id}-gallery-1`,
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: gridLayout === "mosaic" ? "bento" : "mosaic",
            heading: "Inside our work",
            images: shared.map((img) => ({ imageId: img.id, alt: img.alt })),
            items: [
              { imageId: imgs.section1.id, title: "Focused craft" },
              { imageId: imgs.section2.id, title: "Built to last" },
            ],
          },
        },
        {
          id: `${id}-phone-1`,
          type: "text",
          includeIf: "phone",
          props: {
            heading: "Talk with us directly",
            text: "Call {{businessName}} on {{phone}} during {{hoursNote}}.",
          },
        },
        {
          id: `${id}-cta-1`,
          type: "cta",
          props: {
            layout: "split",
            heading: "Ready to work with {{businessName}}?",
            subheading: "{{description}}",
            buttonLabel: "Start a conversation",
            buttonLink: { type: "url", url: "/contact" },
          },
        },
      ],
    },
    {
      key: "about",
      id: `${id}-about`,
      title: "About",
      path: "/about",
      isHome: false,
      showInMenu: true,
      seoTitle: "About | {{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: `${id}-about-text`,
          type: "text",
          props: {
            heading: "About {{businessName}}",
            text: "{{description}}",
          },
        },
        {
          id: `${id}-faq-1`,
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Common questions",
            items: [
              { title: "How do we get started?", text: "Send us a short message and we will respond within one business day." },
              { title: "Where do you serve?", text: "We work with clients across {{areaServed}}." },
            ],
          },
        },
      ],
    },
    {
      key: "services",
      id: `${id}-services`,
      title: "Services",
      path: "/services",
      isHome: false,
      showInMenu: true,
      seoTitle: "Services | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: `${id}-services-features`,
          type: "features",
          sampleOnly: true,
          props: {
            layout: "bento",
            heading: "How {{businessName}} helps",
            items: [
              { title: "Tailored planning", text: "Clear recommendations scoped around your goals." },
              { title: "Dedicated delivery", text: "Reliable execution and follow-through." },
            ],
          },
        },
      ],
    },
    contactTailPage(id, "Message {{businessName}}", false),
  ];
}

const STARTER_COMPOSITIONS: TemplateComposition[] = [
  {
    id: "starter-1",
    name: "Haven Flagship",
    theme: { presetId: "starter", palette: "fresh-green", corners: "soft", density: "comfortable", fonts: { heading: { id: "Bricolage Grotesque", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "even", buttonShape: "soft" } },
    pages: buildStarterCompositionPages("starter-1", "offset-frame", "features", "rows"),
  },
  {
    id: "starter-2",
    name: "Ocean Center",
    theme: { presetId: "starter", palette: "ocean", corners: "round", density: "airy", fonts: { heading: { id: "Manrope", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "alternate", buttonShape: "pill" } },
    pages: buildStarterCompositionPages("starter-2", "centered", "stats", "compact"),
  },
  {
    id: "starter-3",
    name: "Berry Editorial",
    theme: { presetId: "starter", palette: "berry", corners: "round", density: "comfortable", fonts: { heading: { id: "Fraunces", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "tinted", buttonShape: "round" } },
    pages: buildStarterCompositionPages("starter-3", "editorial", "testimonials", "bento"),
  },
  {
    id: "starter-4",
    name: "Sunset Bold",
    theme: { presetId: "starter", palette: "sunset", corners: "soft", density: "compact", fonts: { heading: { id: "Space Grotesk", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "split" }, design: { rhythm: "bold", buttonShape: "square" } },
    pages: buildStarterCompositionPages("starter-4", "fullbleed", "pricing", "rows"),
  },
  {
    id: "starter-5",
    name: "Midnight Clean",
    theme: { presetId: "starter", palette: "midnight", corners: "sharp", density: "airy", fonts: { heading: { id: "Lora", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "minimal" }, design: { rhythm: "even", buttonShape: "square" } },
    pages: buildStarterCompositionPages("starter-5", "minimal", "before-after", "alternating"),
  },
  {
    id: "starter-6",
    name: "Charcoal Serif",
    theme: { presetId: "starter", palette: "charcoal", corners: "soft", density: "comfortable", fonts: { heading: { id: "DM Serif Display", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "alternate", buttonShape: "soft" } },
    pages: buildStarterCompositionPages("starter-6", "arch", "menu", "menu-list"),
  },
  {
    id: "starter-7",
    name: "Green Baskerville",
    theme: { presetId: "starter", palette: "fresh-green", corners: "soft", density: "comfortable", fonts: { heading: { id: "Libre Baskerville", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "tinted", buttonShape: "soft" } },
    pages: buildStarterCompositionPages("starter-7", "split", "testimonials", "rows"),
  },
  {
    id: "starter-8",
    name: "Studio Oswald",
    theme: { presetId: "starter", palette: "sunset", corners: "sharp", density: "compact", fonts: { heading: { id: "Oswald", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "bold", buttonShape: "square" } },
    pages: buildStarterCompositionPages("starter-8", "diagonal", "stats", "compact"),
  },
  {
    id: "starter-9",
    name: "Elegant Cormorant",
    theme: { presetId: "starter", palette: "berry", corners: "round", density: "airy", fonts: { heading: { id: "Cormorant Garamond", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "alternate", buttonShape: "pill" } },
    pages: buildStarterCompositionPages("starter-9", "card-over-image", "features", "mosaic"),
  },
  {
    id: "starter-10",
    name: "Tech Mono",
    theme: { presetId: "starter", palette: "charcoal", corners: "sharp", density: "comfortable", fonts: { heading: { id: "JetBrains Mono", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "minimal" }, design: { rhythm: "even", buttonShape: "square" } },
    pages: buildStarterCompositionPages("starter-10", "product-shot", "features", "bento"),
  },
];

// 1. Frame (creative-studio): Photographer / Visual Portfolio
function buildCreativeStudioPages(): TemplatePageDef[] {
  const imgs = imagesForSlug("creative-studio");
  return [
    {
      key: "home",
      id: "cs-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}} — Visual Portfolio",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "cs-hero",
          type: "hero",
          props: {
            layout: "editorial",
            eyebrow: "Selected Studies · Visual Archive",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "View work",
            buttonLink: { type: "url", url: "/projects" },
          },
        },
        {
          id: "cs-gallery",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "masonry",
            eyebrow: "01 / Monographs",
            heading: "Asymmetric editorial index",
            items: [
              { imageId: imgs.section1.id, category: "Documentary", title: "Solstice Field Studies", text: "Natural daylight series recorded over winter solstice." },
              { imageId: imgs.portrait.id, category: "Portrait", title: "Ceramicist in Stillness", text: "Medium-format portrait study on raw linen." },
              { imageId: imgs.section2.id, category: "Architecture", title: "Timber & Limestone", text: "Spatial studies of coastal studio spaces." },
            ],
          },
        },
        {
          id: "cs-about-split",
          type: "image-text",
          sampleOnly: true,
          props: {
            layout: "split",
            eyebrow: "02 / About",
            heading: "Quiet observation, unhurried craft",
            text: "{{description}}",
            imageId: imgs.portrait.id,
            buttonLabel: "Read artist statement",
            buttonLink: { type: "url", url: "/process" },
          },
        },
        {
          id: "cs-cta-email",
          type: "cta",
          props: {
            layout: "minimal",
            eyebrow: "03 / Inquiries",
            heading: "Commissions & editorial assignments",
            subheading: "Direct studio correspondence — no lengthy intake forms.",
            buttonLabel: "Write directly",
            buttonLink: { type: "url", url: "/contact" },
          },
        },
      ],
    },
    {
      key: "projects",
      id: "cs-projects",
      title: "Work",
      path: "/projects",
      showInMenu: true,
      seoTitle: "Work | {{businessName}}",
      seoDescription: "Visual sequences by {{businessName}}",
      blocks: [
        {
          id: "cs-sequence",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "stacked",
            heading: "Monograph I — Northern Coast",
            subheading: "A full-width image sequence paired with short field notes.",
            items: [
              { imageId: imgs.hero.id, category: "Plate 01", title: "First light over tidal flats", text: "Shot at dawn on 120 film without artificial fill." },
              { imageId: imgs.section1.id, category: "Plate 02", title: "Studio worktable", text: "Raw mineral pigments, hand-pressed cotton rag paper, quiet focus." },
              { imageId: imgs.section2.id, category: "Plate 03", title: "Evening shadow line", text: "Long exposure catching architectural quietness at dusk." },
            ],
          },
        },
      ],
    },
    {
      key: "process",
      id: "cs-process",
      title: "About",
      path: "/process",
      showInMenu: true,
      seoTitle: "About | {{businessName}}",
      seoDescription: "Background and commissions",
      blocks: [
        {
          id: "cs-bio-split",
          type: "image-text",
          props: {
            layout: "split-reverse",
            eyebrow: "Studio Practice",
            heading: "Working with natural light and permanence",
            text: "{{description}}",
            imageId: imgs.portrait.id,
          },
        },
        {
          id: "cs-engagements",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "table-list",
            heading: "Commission formats",
            items: [
              { title: "Editorial Day Rate", price: "$1,400", text: "Full-day location or studio session with curated print selects." },
              { title: "Campaign Monograph", price: "$4,200", text: "Multi-day visual story, art direction, and archival delivery." },
            ],
          },
        },
      ],
    },
    {
      key: "faq",
      id: "cs-faq",
      title: "Notes",
      path: "/faq",
      showInMenu: true,
      seoTitle: "Notes | {{businessName}}",
      seoDescription: "Studio commissions FAQ",
      blocks: [
        {
          id: "cs-faq-items",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Archival & booking notes",
            items: [
              { title: "How are finals delivered?", text: "High-resolution TIFF and web editions arrive via private gallery archive within ten days." },
              { title: "Do you travel for commissions?", text: "Yes, assignments across {{areaServed}} and international destinations are scheduled quarterly." },
            ],
          },
        },
      ],
    },
    contactTailPage("cs", "Direct studio correspondence", false),
  ];
}

// 2. Meridian (law-firm): Law Firm
function buildLawFirmPages(): TemplatePageDef[] {
  const imgs = imagesForSlug("law-firm");
  return [
    {
      key: "home",
      id: "law-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}} | Legal Counsel",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "law-hero",
          type: "hero",
          props: {
            layout: "statement",
            eyebrow: "Principled Representation",
            heading: "Clarity in complex matters",
            subheading: "{{tagline}}",
            buttonLabel: "Book a Consultation",
            buttonLink: { type: "url", url: "/contact" },
            button2Label: "Our Practice Areas",
            button2Link: { type: "url", url: "/practice-areas" },
          },
        },
        {
          id: "law-trust-bar",
          type: "stats",
          sampleOnly: true,
          props: {
            layout: "compact",
            heading: "Standing & experience",
            items: [
              { value: "28 Years", title: "Established practice", text: "Partner-led counsel on every mandate." },
              { value: "1,400+", title: "Matters resolved", text: "Commercial agreements, property, and disputes." },
              { value: "Bar Certified", title: "Regional admissions", text: "Practicing across {{areaServed}}." },
            ],
          },
        },
        {
          id: "law-practice",
          type: "services",
          sampleOnly: true,
          props: {
            layout: "three-col",
            eyebrow: "Areas of Practice",
            heading: "Focused counsel across core legal disciplines",
            items: [
              { number: "01", title: "Corporate & Commercial", text: "Shareholder agreements, entity structuring, and cross-border contracts." },
              { number: "02", title: "Real Estate & Property", text: "Title diligence, commercial leases, and complex closings." },
              { number: "03", title: "Civil Litigation", text: "Measured courtroom advocacy and structured resolution." },
              { number: "04", title: "Employment Counsel", text: "Executive contracts, workplace policy, and severance review." },
              { number: "05", title: "Private Wealth & Trusts", text: "Succession planning and multi-generational asset stewardship." },
              { number: "06", title: "Regulatory & Compliance", text: "Licensing frameworks and statutory risk audits." },
            ],
          },
        },
        {
          id: "law-testimonials",
          type: "testimonials",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Notable results & client perspectives",
            items: [
              { quote: "Measured counsel at every turn and absolute transparency on fee terms.", author: "Managing Director, Commercial Logistics" },
              { quote: "Closed a three-party acquisition ahead of schedule with zero surprises.", author: "General Counsel, Regional Manufacturing" },
            ],
          },
        },
        {
          id: "law-phone",
          type: "text",
          includeIf: "phone",
          props: {
            heading: "Chambers intake desk",
            text: "Speak directly with our chambers desk at {{phone}} ({{hoursNote}}).",
          },
        },
      ],
    },
    {
      key: "practice",
      id: "law-practice-page",
      title: "Practice Areas",
      path: "/practice-areas",
      showInMenu: true,
      seoTitle: "Practice Areas | {{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "law-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "How matters are handled",
            items: [
              { title: "What happens at the first consultation?", text: "We review key documents and outline practical legal options in plain language." },
              { title: "How are retainers structured?", text: "Every engagement starts with a clear written scope and transparent fee schedule." },
            ],
          },
        },
      ],
    },
    {
      key: "attorneys",
      id: "law-team-page",
      title: "Attorneys",
      path: "/attorneys",
      showInMenu: true,
      seoTitle: "Attorneys | {{businessName}}",
      seoDescription: "Counsel at {{businessName}}",
      blocks: [
        {
          id: "law-team",
          type: "team",
          sampleOnly: true,
          props: {
            layout: "three-col",
            heading: "Our legal team",
            items: [
              { photoId: imgs.portrait.id, name: "Managing Partner", role: "Corporate & Commercial Law", text: "Over twenty years advising founders and boards.", buttonLabel: "View profile", buttonLink: { type: "url", url: "/contact" } },
              { photoId: imgs.section1.id, name: "Senior Partner", role: "Real Estate & Regulatory", text: "Lead counsel on high-value commercial conveyancing.", buttonLabel: "View profile", buttonLink: { type: "url", url: "/contact" } },
              { photoId: imgs.section2.id, name: "Litigation Counsel", role: "Arbitration & Disputes", text: "Representing clients in commercial settlements.", buttonLabel: "View profile", buttonLink: { type: "url", url: "/contact" } },
            ],
          },
        },
      ],
    },
    contactTailPage("law", "Request a confidential consultation", true),
  ];
}

// 3. Ember (restaurant): Restaurant
function buildRestaurantPages(): TemplatePageDef[] {
  const imgs = imagesForSlug("restaurant");
  return [
    {
      key: "home",
      id: "rest-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "rest-hero",
          type: "hero",
          props: {
            layout: "fullbleed",
            eyebrow: "Wood-Fired Kitchen · Evening Table",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Reserve a Table",
            buttonLink: { type: "url", url: "/contact" },
            button2Label: "View Menu",
            button2Link: { type: "url", url: "/menu" },
          },
        },
        {
          id: "rest-chef-story",
          type: "image-text",
          sampleOnly: true,
          props: {
            layout: "split",
            eyebrow: "Chef's Kitchen",
            heading: "Slow fire, seasonal harvests, generous plates",
            text: "{{description}}",
            imageId: imgs.portrait.id,
            buttonLabel: "Read our kitchen story",
            buttonLink: { type: "url", url: "/story" },
          },
        },
        {
          id: "rest-menu-tabs",
          type: "menu",
          sampleOnly: true,
          props: {
            layout: "menu-list",
            eyebrow: "Nightly Tasting",
            heading: "Seasonal menus",
            tabs: [
              {
                id: "starters",
                label: "Starters",
                featuredImageId: imgs.section1.id,
                intro: "Shared small plates baked in the wood oven and finished over oak embers.",
                items: [
                  { title: "House Sourdough & Cultured Butter", price: "$9", text: "Stone-milled loaf baked fresh each afternoon with sea-salt flakes." },
                  { title: "Wood-Roasted Heirloom Carrots", price: "$14", text: "Whipped sesame tahini, toasted pistachio, pomegranate glaze." },
                  { title: "Charred Octopus & Chickpea", price: "$19", text: "Smoked paprika oil, preserved lemon, wild fennel." },
                ],
              },
              {
                id: "mains",
                label: "Mains",
                featuredImageId: imgs.hero.id,
                intro: "Hearty main courses built around heritage produce and open-flame roasting.",
                items: [
                  { title: "Charred Seabass Fillet", price: "$31", text: "Fennel saffron broth, crushed new potatoes, charred leek." },
                  { title: "Oak-Grilled Ribeye", price: "$42", text: "Bone-marrow herb butter, roasted shallots, crispy rosemary." },
                  { title: "Wild Mushroom Pappardelle", price: "$25", text: "Hand-cut pasta, aged pecorino, black pepper emulsion." },
                ],
              },
              {
                id: "desserts",
                label: "Desserts",
                featuredImageId: imgs.section2.id,
                intro: "Warm pastry craft and toasted spices to close the evening.",
                items: [
                  { title: "Brown-Butter Almond Tart", price: "$12", text: "Cultured cream, roasted black figs, wildflower honey." },
                  { title: "Dark Chocolate Olive Oil Cake", price: "$13", text: "Sea-salt caramel and espresso mascarpone." },
                ],
              },
              {
                id: "drinks",
                label: "Drinks",
                featuredImageId: imgs.section1.id,
                intro: "Low-intervention cellar pours and house botanical aperitifs.",
                items: [
                  { title: "Blood Orange Negroni", price: "$15", text: "Small-batch gin, charred rosemary, bitter citrus." },
                  { title: "Ginger Hibiscus Spritz (Zero-Proof)", price: "$9", text: "Steeped hibiscus petals, fresh lime, sparkling mineral water." },
                ],
              },
            ],
          },
        },
        {
          id: "rest-gallery-strip",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "strip",
            heading: "Inside the dining room",
            items: [
              { imageId: imgs.section1.id, title: "Open hearth kitchen" },
              { imageId: imgs.section2.id, title: "Candlelit cellar table" },
              { imageId: imgs.hero.id, title: "Evening plating" },
              { imageId: imgs.portrait.id, title: "Pastry station" },
            ],
          },
        },
        {
          id: "rest-reserve-cta",
          type: "cta",
          props: {
            layout: "centered",
            tone: "accent",
            eyebrow: "Table Bookings",
            heading: "Join us around the table tonight",
            subheading: "Walk-ins welcome at the counter; dinner reservations open thirty days ahead.",
            buttonLabel: "Book your table",
            buttonLink: { type: "url", url: "/contact" },
          },
        },
      ],
    },
    {
      key: "menu",
      id: "rest-menu-page",
      title: "Menu",
      path: "/menu",
      showInMenu: true,
      seoTitle: "Menu | {{businessName}}",
      seoDescription: "Seasonal dishes at {{businessName}}",
      blocks: [
        {
          id: "rest-full-menu",
          type: "menu",
          sampleOnly: true,
          props: {
            layout: "menu-list",
            heading: "Evening kitchen list",
            items: [
              { title: "Warm sourdough & smoked salt butter", price: "$9", text: "Fermented 36 hours in stone hearths." },
              { title: "Braised short rib", price: "$34", text: "Root vegetables, charred shallots, red wine jus." },
              { title: "Citrus olive oil cake", price: "$11", text: "Served warm with whipped mascarpone." },
            ],
          },
        },
      ],
    },
    {
      key: "story",
      id: "rest-story",
      title: "Story",
      path: "/story",
      showInMenu: true,
      seoTitle: "Our Story | {{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "rest-story-text",
          type: "text",
          props: {
            heading: "Sourced close to home",
            text: "{{description}}",
          },
        },
        {
          id: "rest-hours-note",
          type: "text",
          includeIf: "hours",
          props: {
            heading: "Kitchen hours",
            text: "Dining room open {{hoursNote}} at {{address}}.",
          },
        },
        {
          id: "rest-schedule",
          type: "schedule",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Weekly seatings",
            items: [
              { title: "Midday Hearth Lunch", time: "Thu–Sun · 12:00pm – 2:30pm", text: "Wood-fired flatbreads and crisp market greens." },
              { title: "Evening Dinner Service", time: "Tue–Sun · 5:30pm – 10:30pm", text: "Full tasting plates, cellar pours, and warm desserts." },
            ],
          },
        },
      ],
    },
    contactTailPage("rest", "Reserve a table or private dining", true, "accent"),
  ];
}

// 4. Concrete (developer-portfolio): Architecture & Structural Studio
function buildPortfolioPages(): TemplatePageDef[] {
  const imgs = imagesForSlug("developer-portfolio");
  return [
    {
      key: "home",
      id: "dev-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}} — Architecture & Spatial Studio",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "dev-hero",
          type: "hero",
          props: {
            layout: "minimal",
            eyebrow: "STUDIO 04 · 51.5074° N / 2026",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.portrait.id,
            buttonLabel: "Explore index",
            buttonLink: { type: "url", url: "/work" },
          },
        },
        {
          id: "dev-work-index",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "index-list",
            eyebrow: "Selected Works Index",
            heading: "Built Commissions (01–04)",
            items: [
              { number: "01", imageId: imgs.section1.id, title: "Quay Foundry Pavilions", year: "2025", coordinates: "53.4084° N, 2.9916° W", text: "Adaptive concrete & timber workspace along the canal." },
              { number: "02", imageId: imgs.section2.id, title: "Northlight Civic Library", year: "2024", coordinates: "55.9533° N, 3.1883° W", text: "Daylit reading atrium anchored by precast masonry walls." },
              { number: "03", imageId: imgs.hero.id, title: "Basalt Ridge Residence", year: "2024", coordinates: "51.4545° N, 2.5879° W", text: "Passive solar courtyard house set directly into hillside stone." },
              { number: "04", imageId: imgs.portrait.id, title: "Signal Tower Canopy", year: "2023", coordinates: "52.4862° N, 1.8904° W", text: "Cantilevered weathered steel transit shelter." },
            ],
          },
        },
        {
          id: "dev-studio-table",
          type: "team",
          sampleOnly: true,
          props: {
            layout: "table-list",
            eyebrow: "Practice Directory",
            heading: "Principals & Engineers",
            items: [
              { name: "Lead Architect, RIBA", role: "Spatial Strategy & Massing", year: "Partner" },
              { name: "Structural Principal", role: "Timber & Cast Concrete Systems", year: "Partner" },
              { name: "Technical Associate", role: "Building Envelope & Detailing", year: "Senior" },
            ],
          },
        },
        {
          id: "dev-cta-arrow",
          type: "cta",
          props: {
            layout: "minimal",
            eyebrow: "Direct Commission",
            heading: "Initiate a site brief ↗",
            subheading: "Available for cultural, civic, and residential commissions across {{areaServed}}.",
            buttonLabel: "Open Studio Contact ↗",
            buttonLink: { type: "url", url: "/contact" },
          },
        },
      ],
    },
    {
      key: "work",
      id: "dev-work",
      title: "Case Studies",
      path: "/work",
      showInMenu: true,
      seoTitle: "Case Studies | {{businessName}}",
      seoDescription: "Plans, sections, and spatial studies",
      blocks: [
        {
          id: "dev-work-strip",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "strip",
            heading: "Quay Foundry — Plans & Elevations",
            subheading: "Horizontal documentation strip showing structural phases.",
            items: [
              { imageId: imgs.section1.id, title: "01. Site Axis & Massing", coordinates: "Scale 1:200", text: "Grid alignment locked to existing stone quay walls." },
              { imageId: imgs.section2.id, title: "02. Truss Section", coordinates: "Scale 1:50", text: "Exposed cross-laminated timber beams spanning 14m clear." },
              { imageId: imgs.hero.id, title: "03. Finished Atrium", coordinates: "2025", text: "North-facing glazing balancing thermal mass." },
            ],
          },
        },
      ],
    },
    {
      key: "notes",
      id: "dev-notes",
      title: "Studio",
      path: "/notes",
      showInMenu: true,
      seoTitle: "Studio | {{businessName}}",
      seoDescription: "Material philosophy",
      blocks: [
        {
          id: "dev-notes-text",
          type: "text",
          props: {
            heading: "Structural clarity",
            text: "{{description}}",
          },
        },
        {
          id: "dev-notes-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Commission scope",
            items: [
              { title: "What RIBA stages do you cover?", text: "Full architectural delivery from feasibility (Stage 0) through handover (Stage 7)." },
              { title: "Where is the studio based?", text: "Our workshop operates across {{areaServed}}." },
            ],
          },
        },
      ],
    },
    contactTailPage("dev", "Submit a project brief", false),
  ];
}

// 5. Willow (salon-beauty): Wellness / Yoga Studio
function buildSalonPages(): TemplatePageDef[] {
  const imgs = imagesForSlug("salon-beauty");
  return [
    {
      key: "home",
      id: "salon-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}} — Movement & Calm",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "salon-hero",
          type: "hero",
          props: {
            layout: "arch",
            eyebrow: "Breathe · Move · Restore",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Try a free class",
            buttonLink: { type: "url", url: "/contact" },
            button2Label: "Weekly schedule",
            button2Link: { type: "url", url: "/treatments" },
          },
        },
        {
          id: "salon-classes",
          type: "services",
          sampleOnly: true,
          props: {
            layout: "three-col",
            eyebrow: "Daily Practice",
            heading: "Signature studio classes",
            items: [
              { category: "Restorative", title: "Slow Flow Vinyasa", duration: "60 min", level: "All levels", text: "Unrushed breath-led sequences easing neck and hip tension." },
              { category: "Mobility", title: "Morning Mat & Breathwork", duration: "45 min", level: "Gentle", text: "Grounded stretching and nasal cadence to start the morning." },
              { category: "Deep Rest", title: "Candlelight Sound Bath", duration: "75 min", level: "Open", text: "Bolstered stillness paired with warm acoustic resonance." },
            ],
          },
        },
        {
          id: "salon-timetable",
          type: "schedule",
          sampleOnly: true,
          props: {
            layout: "rows",
            eyebrow: "Weekly Timetable",
            heading: "Reserve your spot on the mat",
            items: [
              { category: "Morning Flow", title: "Vinyasa & Breath", time: "Mon / Wed / Fri · 7:30am", text: "Led in our sunlit east room with natural cork mats.", buttonLabel: "Reserve spot", buttonLink: { type: "url", url: "/contact" } },
              { category: "Midday Reset", title: "Posture & Mobility", time: "Tue / Thu · 12:15pm", text: "Focused shoulder and spine release in 45 minutes.", buttonLabel: "Reserve spot", buttonLink: { type: "url", url: "/contact" } },
              { category: "Evening Stillness", title: "Yin & Warm Tea", time: "Sun · 6:00pm", text: "Deep floor poses followed by chamomile infusion.", buttonLabel: "Reserve spot", buttonLink: { type: "url", url: "/contact" } },
            ],
          },
        },
        {
          id: "salon-team",
          type: "team",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Guides & instructors",
            items: [
              { photoId: imgs.portrait.id, name: "Lead Instructor", role: "Vinyasa & Breathwork", quote: "\"Movement feels sustainable when we stop rushing the transitions.\"" },
              { photoId: imgs.section1.id, name: "Somatic Specialist", role: "Yin & Nervous System Care", quote: "\"True strength grows out of unhurried rest.\"" },
            ],
          },
        },
        {
          id: "salon-newsletter",
          type: "newsletter",
          props: {
            eyebrow: "Quiet Notes",
            heading: "Seasonal workshop invitations",
            subheading: "One gentle note per month — new weekend retreats, solstice sessions, and studio hours.",
            buttonLabel: "Join circle",
            placeholder: "you@example.com",
          },
        },
      ],
    },
    {
      key: "treatments",
      id: "salon-treatments",
      title: "Memberships",
      path: "/treatments",
      showInMenu: true,
      seoTitle: "Memberships | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: "salon-pricing",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "three-col",
            heading: "Unhurried studio memberships",
            items: [
              { title: "Single Drop-In", price: "$24", text: "Any 60-minute practice with mat and herbal tea included.", features: ["Mat & props provided", "Tea lounge access"] },
              { category: "Most loved", highlighted: true, title: "Unlimited Sanctuary", price: "$128/mo", text: "Unlimited weekly classes plus one guest pass every month.", features: ["Unlimited classes", "Monthly guest pass", "Workshop discounts"] },
              { title: "Five-Class Pack", price: "$98", text: "Flexible pack valid across six months for busy schedules.", features: ["Shareable with a friend", "6-month validity"] },
            ],
          },
        },
      ],
    },
    {
      key: "studio",
      id: "salon-studio",
      title: "The Space",
      path: "/lounge",
      showInMenu: true,
      seoTitle: "The Space | {{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "salon-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Preparing for your first class",
            items: [
              { title: "Do I need to bring a yoga mat?", text: "No — natural cork mats, linen bolsters, and organic cotton blankets are set out for you." },
              { title: "When should I arrive?", text: "Doors open fifteen minutes early so you can settle in with warm herbal tea." },
            ],
          },
        },
      ],
    },
    contactTailPage("salon", "Book your introductory free class", true),
  ];
}

// 6. Pulse (software-company): SaaS / Tech Startup
function buildSoftwarePages(): TemplatePageDef[] {
  const imgs = imagesForSlug("software-company");
  return [
    {
      key: "home",
      id: "sw-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}} — Product-First Software Platform",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "sw-hero",
          type: "hero",
          props: {
            layout: "product-shot",
            eyebrow: "v4.2 · Real-Time Edge Platform",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Start Free",
            buttonLink: { type: "url", url: "/pricing" },
            button2Label: "Watch Demo",
            button2Link: { type: "url", url: "/platform" },
          },
        },
        {
          id: "sw-logos",
          type: "stats",
          sampleOnly: true,
          props: {
            layout: "logo-strip",
            heading: "Trusted by modern engineering orgs",
            items: [
              { value: "99.99%", title: "Uptime SLA" },
              { value: "< 18ms", title: "Global Edge p95" },
              { value: "4.2B", title: "Daily Events" },
              { value: "SOC 2", title: "Type II Certified" },
            ],
          },
        },
        {
          id: "sw-features",
          type: "features",
          sampleOnly: true,
          props: {
            layout: "bento",
            eyebrow: "Capabilities",
            heading: "Built for teams shipping multiple times a day",
            items: [
              { category: "Live Pipeline", title: "Zero-config event routing", text: "Stream webhooks, cron triggers, and AI tasks across isolated workers without YAML sprawl." },
              { category: "Access", title: "Scoped RBAC tokens", text: "Per-environment permissions with instant key rotation." },
              { category: "Observability", title: "Sub-second trace replay", text: "Inspect payloads, latency waterfalls, and token spend in one view." },
            ],
          },
        },
        {
          id: "sw-how-it-works",
          type: "services",
          sampleOnly: true,
          props: {
            layout: "three-col",
            eyebrow: "How It Works",
            heading: "From zero to production in three steps",
            items: [
              { number: "01", title: "Connect your repo", text: "Import TypeScript handlers directly with typed schemas and instant previews." },
              { number: "02", title: "Configure policies", text: "Set rate caps, retries, and role gates declaratively." },
              { number: "03", title: "Deploy everywhere", text: "Ship globally across edge regions with live telemetry." },
            ],
          },
        },
        {
          id: "sw-cta",
          type: "cta",
          props: {
            layout: "centered",
            heading: "Ready to accelerate with {{businessName}}?",
            subheading: "{{description}}",
            buttonLabel: "Start building free",
            buttonLink: { type: "url", url: "/contact" },
          },
        },
      ],
    },
    {
      key: "product",
      id: "sw-product",
      title: "Product",
      path: "/platform",
      showInMenu: true,
      seoTitle: "Product | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: "sw-platform-gallery",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "bento",
            heading: "Inside the workspace",
            items: [
              { imageId: imgs.section1.id, title: "Visual workflow canvas", text: "Inspect every branch, retry policy, and queue depth live." },
              { imageId: imgs.section2.id, title: "Trace & cost inspector", text: "Track neuron usage, tokens, and response percentiles per route." },
            ],
          },
        },
      ],
    },
    {
      key: "pricing",
      id: "sw-pricing",
      title: "Pricing",
      path: "/pricing",
      showInMenu: true,
      seoTitle: "Pricing | {{businessName}}",
      seoDescription: "Monthly & annual plans from {{businessName}}",
      blocks: [
        {
          id: "sw-pricing-tiers",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "three-col",
            heading: "Simple, usage-transparent pricing",
            items: [
              { title: "Starter", price: "$29/mo", annualPrice: "$23/mo", text: "Up to 5 seats and 250k edge runs monthly.", features: ["5 team seats", "30-day log retention", "Community support"] },
              { category: "Recommended", highlighted: true, title: "Growth", price: "$89/mo", annualPrice: "$71/mo", text: "Unlimited workflows, SSO, and real-time trace replay.", features: ["Unlimited seats", "SAML SSO & RBAC", "Priority SLA"] },
              { title: "Scale", price: "Custom", annualPrice: "Custom", text: "Dedicated throughput clusters and compliance reporting.", features: ["Custom retention", "Dedicated engineer", "99.99% SLA"] },
            ],
          },
        },
      ],
    },
    {
      key: "faq",
      id: "sw-faq",
      title: "FAQ",
      path: "/faq",
      showInMenu: true,
      seoTitle: "FAQ | {{businessName}}",
      seoDescription: "Answers from {{businessName}}",
      blocks: [
        {
          id: "sw-faq-list",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Technical questions",
            items: [
              { title: "How long does onboarding take?", text: "Most teams connect repositories and deploy their first worker in under ten minutes." },
              { title: "Can we export all workspace logs?", text: "Yes, OpenTelemetry and JSON exports are available on every tier." },
            ],
          },
        },
      ],
    },
    contactTailPage("sw", "Book a live engineering walkthrough", false),
  ];
}

// 7. Clearview (home-services): Dental / Medical Clinic
function buildHomeServicesPages(): TemplatePageDef[] {
  const imgs = imagesForSlug("home-services");
  return [
    {
      key: "home",
      id: "hs-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}} — Family Dental & Preventive Care",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "hs-hero",
          type: "hero",
          props: {
            layout: "split",
            eyebrow: "Gentle Modern Care · New Patients Welcome",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            text: "Same-week appointments, calm private treatment suites, and clear upfront care plans.",
            imageId: imgs.hero.id,
            buttonLabel: "Book Appointment",
            buttonLink: { type: "url", url: "/contact" },
            button2Label: "Explore Services",
            button2Link: { type: "url", url: "/services" },
          },
        },
        {
          id: "hs-quick-strip",
          type: "stats",
          sampleOnly: true,
          props: {
            layout: "quick-strip",
            heading: "Clinic essentials",
            items: [
              { value: "Same Day", title: "Emergency line", text: "Dedicated urgent toothache & repair slots every morning." },
              { value: "Direct Billing", title: "Insurance accepted", text: "Major family & employer health plans filed at reception." },
              { value: "Evening Care", title: "Open late Tue & Thu", text: "Convenient early and after-work bookings." },
            ],
          },
        },
        {
          id: "hs-services-expand",
          type: "services",
          sampleOnly: true,
          props: {
            layout: "rows",
            expandable: true,
            eyebrow: "Treatments",
            heading: "Comprehensive dental care under one roof",
            items: [
              { category: "Preventive", title: "Cleaning & Gentle Checkups", duration: "45 min", text: "Digital low-radiation scans and warm-water hygiene polish.", details: "Includes ultrasonic tartar removal, periodontal screening, fluoride-free or enamel-safe polish, and a plain-language written checkup summary." },
              { category: "Cosmetic", title: "Enamel-Safe Whitening", duration: "60 min", text: "Lift coffee and age staining up to six shades comfortably.", details: "Pre-treated with desensitizing minerals so even sensitive teeth stay comfortable during and after the studio session." },
              { category: "Restorative", title: "Implants & Crowns", duration: "Custom plan", text: "Natural-shade ceramics matched seamlessly to your smile.", details: "3D digital impressions eliminate putty trays, pairing guided placement with lifelike porcelain restorations." },
              { category: "Alignment", title: "Clear Orthodontics", duration: "6–14 months", text: "Discreet removable aligners checked monthly with gentle digital scans.", details: "Preview your projected bite alignment at consultation before deciding, with flexible zero-interest monthly plans." },
            ],
          },
        },
        {
          id: "hs-before-after",
          type: "before-after",
          sampleOnly: true,
          props: {
            heading: "Patient treatment outcomes",
            items: [
              {
                title: "Enamel bonding & whitening restoration",
                beforeText: "Chipped incisal edges and uneven surface shading causing smile hesitation.",
                afterText: "Micro-layered porcelain shade matching and gentle edge contouring in two calm visits.",
                text: "Two-visit conservative smile balance with zero tooth sensitivity.",
              },
              {
                title: "Clear aligner bite harmony",
                beforeText: "Lower crowding creating uneven wear.",
                afterText: "Aligned arch symmetry in 8 months of removable aligners.",
                text: "Completed comfortably with digital check-ins.",
              },
            ],
          },
        },
        {
          id: "hs-phone",
          type: "text",
          includeIf: "phone",
          props: {
            heading: "Reception & urgent dental line",
            text: "Call {{businessName}} on {{phone}} during {{hoursNote}}.",
          },
        },
      ],
    },
    {
      key: "services",
      id: "hs-services",
      title: "Team & Services",
      path: "/services",
      showInMenu: true,
      seoTitle: "Team & Services | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: "hs-team",
          type: "team",
          sampleOnly: true,
          props: {
            layout: "three-col",
            heading: "Meet the clinical team",
            items: [
              { photoId: imgs.portrait.id, name: "Lead Dentist, DDS", role: "Restorative & Preventive Care", text: "Known for gentle bedside pacing and crystal-clear explanations." },
              { photoId: imgs.section1.id, name: "Orthodontic Specialist", role: "Clear Aligners & Bite Harmony", text: "12 years designing subtle, lasting alignment plans." },
              { photoId: imgs.section2.id, name: "Lead Hygienist, RDH", role: "Warm-Water Airflow Therapy", text: "Making cleanings calm for anxious first-time visitors." },
            ],
          },
        },
        {
          id: "hs-rates",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Clear self-pay & insurance rates",
            items: [
              { title: "New Patient Exam & Digital Scans", price: "$95", text: "Complete oral wellness review and tailored care roadmap." },
              { title: "Airflow Hygiene Visit", price: "$135", text: "Gentle warm-water clean, polish, and gum health check." },
            ],
          },
        },
      ],
    },
    {
      key: "reviews",
      id: "hs-reviews",
      title: "Patient Reviews",
      path: "/reviews",
      showInMenu: true,
      seoTitle: "Patient Reviews | {{businessName}}",
      seoDescription: "Verified patient stories",
      blocks: [
        {
          id: "hs-testimonials",
          type: "testimonials",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "5.0 ★ Patient reviews",
            items: [
              { category: "★★★★★", quote: "Never thought I'd look forward to dental visits — calm room, warm water cleaning, zero rush.", author: "Priya M." },
              { category: "★★★★★", quote: "Explained my insurance coverage upfront and fixed a broken crown the very same morning.", author: "Gareth T." },
            ],
          },
        },
        {
          id: "hs-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "First visit questions",
            items: [
              { title: "Do you handle nervous patients gently?", text: "Yes — let us know when booking and we schedule extra unhurried time with headphones available." },
              { title: "Where is the clinic located?", text: "Conveniently accessible across {{areaServed}} with ground-floor access." },
            ],
          },
        },
      ],
    },
    contactTailPage("hs", "Book your dental appointment", true),
  ];
}

// 8. Bloom & Bold (boutique-shop): Boutique Florist & Curated Goods
function buildBoutiquePages(): TemplatePageDef[] {
  const imgs = imagesForSlug("boutique-shop");
  return [
    {
      key: "home",
      id: "shop-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}} — Floral & Independent Shop",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "shop-hero",
          type: "hero",
          props: {
            layout: "card-over-image",
            eyebrow: "Daily Fresh Stems & Small-Batch Craft",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Browse collections",
            buttonLink: { type: "url", url: "/collections" },
            button2Label: "Join a workshop",
            button2Link: { type: "url", url: "/makers" },
          },
        },
        {
          id: "shop-gallery",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "mosaic",
            eyebrow: "Atelier Shelves",
            heading: "Shop seasonal categories",
            tabs: [
              {
                id: "bouquets",
                label: "Bouquets",
                featuredImageId: imgs.section1.id,
                intro: "Hand-tied daily from local flower growers using seasonal garden blooms and scented foliage.",
                items: [
                  { imageId: imgs.section1.id, title: "Sunlit Meadow Bunch", price: "$54", text: "Ranunculus, chamomile, eucalyptus, wrapped in raw linen." },
                  { imageId: imgs.hero.id, title: "Velvet Crimson Stem Edit", price: "$78", text: "Sculptural dahlias and wild berries for dinner tables." },
                ],
              },
              {
                id: "plants",
                label: "Potted Plants",
                featuredImageId: imgs.section2.id,
                intro: "Architectural indoor foliage potted in breathable wheel-thrown terracotta.",
                items: [
                  { imageId: imgs.section2.id, title: "Olive Tree in Terracotta", price: "$86", text: "Sun-loving tabletop tree with care guide." },
                  { imageId: imgs.portrait.id, title: "Trailing String of Pearls", price: "$38", text: "Planted in speckled stoneware hanging vessel." },
                ],
              },
              {
                id: "workshops",
                label: "Workshops",
                featuredImageId: imgs.portrait.id,
                intro: "Small Sunday table gatherings learning spiral stem tying and ceramic pairing.",
                items: [
                  { imageId: imgs.portrait.id, title: "Seasonal Bouquet Workshop", price: "$95", time: "Sundays · 10:30am", text: "Take home your wrapped arrangement and ceramic vase." },
                ],
              },
            ],
          },
        },
        {
          id: "shop-features",
          type: "features",
          sampleOnly: true,
          props: {
            layout: "compact",
            heading: "Thoughtful neighbourhood delivery",
            items: [
              { title: "Same-day local courier", text: "Orders before noon arrive fresh across {{areaServed}}." },
              { title: "Zero-plastic wrapping", text: "Kraft paper, dampened linen wraps, and twine." },
            ],
          },
        },
      ],
    },
    {
      key: "collections",
      id: "shop-collections",
      title: "Collections",
      path: "/collections",
      showInMenu: true,
      seoTitle: "Collections | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: "shop-catalog",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "three-col",
            heading: "Subscription stems & gift boxes",
            items: [
              { title: "Host Gift Bundle", price: "$75", text: "Seasonal garden bouquet paired with hand-dipped beeswax tapers." },
              { category: "Favourite", highlighted: true, title: "Bi-Weekly Flower Drop", price: "$62", text: "Fresh grower stems wrapped for your kitchen vase every fortnight." },
              { title: "Atelier Ceramics Edit", price: "$88", text: "Stoneware pitcher accompanied by dried meadow grasses." },
            ],
          },
        },
      ],
    },
    {
      key: "makers",
      id: "shop-makers",
      title: "Makers",
      path: "/makers",
      showInMenu: true,
      seoTitle: "Makers | {{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "shop-about-split",
          type: "image-text",
          props: {
            layout: "split",
            heading: "Grown & gathered close by",
            text: "{{description}}",
            imageId: imgs.portrait.id,
          },
        },
        {
          id: "shop-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Orders & care notes",
            items: [
              { title: "Do you include gift cards?", text: "Handwritten heavy cardstock notes accompany every wrapped parcel." },
              { title: "Can I book the shop for a private class?", text: "Yes, we host intimate creative groups of up to twelve guests." },
            ],
          },
        },
      ],
    },
    contactTailPage("shop", "Order bespoke stems or gifts", false),
  ];
}

// 9. Sprout (community-church): Youth, Family & Community Gathering
function buildCommunityChurchPages(): TemplatePageDef[] {
  const imgs = imagesForSlug("community-church");
  return [
    {
      key: "home",
      id: "ch-home",
      title: "Home",
      path: "/",
      isHome: true,
      showInMenu: true,
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "ch-hero",
          type: "hero",
          props: {
            layout: "centered",
            eyebrow: "Open Doors · All Ages Welcome",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Plan a visit",
            buttonLink: { type: "url", url: "/visit" },
            button2Label: "Weekly schedule",
            button2Link: { type: "url", url: "/community" },
          },
        },
        {
          id: "ch-schedule",
          type: "schedule",
          sampleOnly: true,
          props: {
            layout: "rows",
            eyebrow: "What's On",
            heading: "Weekly gatherings & clubs",
            tabs: [
              {
                id: "sundays",
                label: "Weekend",
                intro: "Relaxed family gatherings with music, coffee, and creative kids rooms.",
                items: [
                  { title: "Sunday Morning Table", time: "Sundays · 10:00am", text: "Warm welcome, acoustic music, and age-grouped kids craft rooms." },
                  { title: "Community Potluck & Games", time: "Last Sunday · 12:30pm", text: "Bring a dish or just bring yourself — plenty for everyone." },
                ],
              },
              {
                id: "midweek",
                label: "Midweek",
                intro: "Practical workshops, youth drop-in, and shared neighbourhood dinners.",
                items: [
                  { title: "Wednesday Shared Supper", time: "Wednesdays · 6:00pm", text: "Hot meal open to families, students, and neighbours." },
                  { title: "After-School Makers & Youth", time: "Fridays · 4:30pm", text: "Homework help, board games, and mentoring." },
                ],
              },
            ],
          },
        },
        {
          id: "ch-cta",
          type: "cta",
          props: {
            layout: "centered",
            heading: "Rooted together across {{areaServed}}",
            subheading: "{{description}}",
            buttonLabel: "Say hello",
            buttonLink: { type: "url", url: "/contact" },
          },
        },
      ],
    },
    {
      key: "visit",
      id: "ch-visit",
      title: "Plan a Visit",
      path: "/visit",
      showInMenu: true,
      seoTitle: "Plan a Visit | {{businessName}}",
      seoDescription: "First-visit guide for {{businessName}}",
      blocks: [
        {
          id: "ch-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "First time here?",
            items: [
              { title: "What should I wear?", text: "Come casually and comfortably — jeans, trainers, whatever feels relaxed." },
              { title: "Are kids and strollers welcome?", text: "Always! Step-free entry and supervised play rooms are open throughout." },
            ],
          },
        },
      ],
    },
    {
      key: "team",
      id: "ch-team",
      title: "Community",
      path: "/community",
      showInMenu: true,
      seoTitle: "Community | {{businessName}}",
      seoDescription: "Programs and volunteers",
      blocks: [
        {
          id: "ch-leaders",
          type: "team",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Coordinators & hosts",
            items: [
              { photoId: imgs.portrait.id, name: "Hospitality Coordinator", role: "Sunday Welcome & Meals", text: "Making sure first-timers have a warm seat and friendly introductions." },
              { photoId: imgs.section1.id, name: "Youth & Outreach Lead", role: "Community Pantry & Clubs", text: "Coordinating after-school groups and local partnerships." },
            ],
          },
        },
      ],
    },
    contactTailPage("ch", "Reach our welcome team", false),
  ];
}

function buildPagesForSlug(slug: string): TemplatePageDef[] {
  switch (slug) {
    case "software-company":
      return buildSoftwarePages();
    case "law-firm":
      return buildLawFirmPages();
    case "restaurant":
      return buildRestaurantPages();
    case "developer-portfolio":
      return buildPortfolioPages();
    case "salon-beauty":
      return buildSalonPages();
    case "boutique-shop":
      return buildBoutiquePages();
    case "home-services":
      return buildHomeServicesPages();
    case "community-church":
      return buildCommunityChurchPages();
    case "creative-studio":
      return buildCreativeStudioPages();
    default:
      return buildStarterCompositionPages(slug, "offset-frame", "features", "rows");
  }
}

type TemplateSpec = {
  slug: string;
  hero: string;
  header: string;
  font: string;
  bodyFont: string;
  corners: "soft" | "sharp" | "round";
  density: "compact" | "comfortable" | "airy";
  buttonShape: "square" | "soft" | "round" | "pill";
  rhythm: "even" | "alternate" | "tinted" | "bold";
  palette: string;
  sampleName: string;
  businessTypes: string[];
};

const TEMPLATE_SPECS: TemplateSpec[] = [
  { slug: "starter", hero: "offset-frame", header: "classic", font: "Bricolage Grotesque", bodyFont: "Figtree", corners: "soft", density: "comfortable", buttonShape: "soft", rhythm: "even", palette: "fresh-green", sampleName: "Haven Street Collective", businessTypes: ["local business", "consultant", "general"] },
  { slug: "software-company", hero: "product-shot", header: "split", font: "Space Grotesk", bodyFont: "Inter", corners: "soft", density: "compact", buttonShape: "round", rhythm: "bold", palette: "pulse", sampleName: "Pulse Cloud Systems", businessTypes: ["software", "saas", "tech"] },
  { slug: "law-firm", hero: "statement", header: "centered", font: "Libre Caslon Text", bodyFont: "Source Sans 3", corners: "sharp", density: "airy", buttonShape: "square", rhythm: "tinted", palette: "meridian", sampleName: "Meridian Law LLP", businessTypes: ["law firm", "legal", "accounting"] },
  { slug: "restaurant", hero: "fullbleed", header: "overlay", font: "DM Serif Display", bodyFont: "Nunito Sans", corners: "round", density: "comfortable", buttonShape: "pill", rhythm: "alternate", palette: "ember", sampleName: "Ember Wood Kitchen", businessTypes: ["restaurant", "cafe", "bakery"] },
  { slug: "developer-portfolio", hero: "minimal", header: "minimal", font: "Anton", bodyFont: "IBM Plex Mono", corners: "sharp", density: "airy", buttonShape: "square", rhythm: "bold", palette: "concrete", sampleName: "CONCRETE ATELIER", businessTypes: ["architecture", "portfolio", "developer"] },
  { slug: "salon-beauty", hero: "arch", header: "centered", font: "Fraunces", bodyFont: "Manrope", corners: "round", density: "airy", buttonShape: "pill", rhythm: "alternate", palette: "willow", sampleName: "Willow Yoga & Wellness", businessTypes: ["yoga", "wellness", "salon", "spa"] },
  { slug: "boutique-shop", hero: "card-over-image", header: "split", font: "Bodoni Moda", bodyFont: "Montserrat", corners: "soft", density: "comfortable", buttonShape: "soft", rhythm: "tinted", palette: "bloom", sampleName: "Bloom & Bold Studio", businessTypes: ["florist", "shop", "retail", "boutique"] },
  { slug: "home-services", hero: "split", header: "classic", font: "Poppins", bodyFont: "Nunito", corners: "round", density: "comfortable", buttonShape: "round", rhythm: "even", palette: "clearview", sampleName: "Clearview Dental Care", businessTypes: ["dental", "clinic", "medical", "home services"] },
  { slug: "community-church", hero: "centered", header: "classic", font: "Baloo 2", bodyFont: "Quicksand", corners: "round", density: "airy", buttonShape: "pill", rhythm: "alternate", palette: "sprout", sampleName: "Sprout Commons", businessTypes: ["community", "youth", "church", "nonprofit"] },
  { slug: "creative-studio", hero: "editorial", header: "minimal", font: "Cormorant Garamond", bodyFont: "Inter", corners: "sharp", density: "airy", buttonShape: "square", rhythm: "even", palette: "frame", sampleName: "FRAME — Lena Mercer", businessTypes: ["photographer", "creative studio", "portfolio"] },
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
      tagline: `${spec.sampleName} crafting clear, attentive experiences every day`,
      description: `${spec.sampleName} brings dedicated craft and attentive personal guidance to clients across the region.`,
      phone: "+1 555 019 4820",
      email: `hello@${spec.slug.replace(/[^a-z0-9]/g, "")}.example`,
      address: "742 Northbridge Terrace, Suite 4B",
      hoursNote: "Mon-Sat 8:30am-6:00pm",
      city: "Northbridge",
      region: "Highland Province",
      country: "Freelandia",
      areaServed: "Greater Northbridge Metro",
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
                presetId: spec.slug,
                palette: spec.palette,
                corners: spec.corners,
                density: spec.density,
                fonts: {
                  heading: { id: spec.font, weight: 700 },
                  body: { id: spec.bodyFont, weight: 400 },
                  scale: "comfortable",
                },
                header: { style: spec.header },
                design: {
                  rhythm: spec.rhythm,
                  buttonShape: spec.buttonShape,
                },
              },
              pages: buildPagesForSlug(spec.slug),
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
