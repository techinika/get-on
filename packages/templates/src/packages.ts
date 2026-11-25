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

function contactTailPage(slug: string, heading: string, showPhone = true): TemplatePageDef {
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
            buttonLink: { type: "anchor", anchor: "contact" },
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
    name: "Warm Split",
    theme: { palette: "fresh-green", corners: "soft", density: "comfortable", fonts: { heading: { id: "Bricolage Grotesque", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "even", buttonShape: "soft" } },
    pages: buildStarterCompositionPages("starter-1", "split", "features", "rows"),
  },
  {
    id: "starter-2",
    name: "Ocean Center",
    theme: { palette: "ocean", corners: "round", density: "airy", fonts: { heading: { id: "Manrope", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "alternate", buttonShape: "pill" } },
    pages: buildStarterCompositionPages("starter-2", "centered", "stats", "compact"),
  },
  {
    id: "starter-3",
    name: "Berry Editorial",
    theme: { palette: "berry", corners: "round", density: "comfortable", fonts: { heading: { id: "Fraunces", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "tinted", buttonShape: "round" } },
    pages: buildStarterCompositionPages("starter-3", "editorial", "testimonials", "bento"),
  },
  {
    id: "starter-4",
    name: "Sunset Bold",
    theme: { palette: "sunset", corners: "soft", density: "compact", fonts: { heading: { id: "Space Grotesk", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "split" }, design: { rhythm: "bold", buttonShape: "square" } },
    pages: buildStarterCompositionPages("starter-4", "fullbleed", "pricing", "rows"),
  },
  {
    id: "starter-5",
    name: "Midnight Clean",
    theme: { palette: "midnight", corners: "sharp", density: "airy", fonts: { heading: { id: "Lora", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "minimal" }, design: { rhythm: "even", buttonShape: "square" } },
    pages: buildStarterCompositionPages("starter-5", "minimal", "before-after", "alternating"),
  },
  {
    id: "starter-6",
    name: "Charcoal Serif",
    theme: { palette: "charcoal", corners: "soft", density: "comfortable", fonts: { heading: { id: "DM Serif Display", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "alternate", buttonShape: "soft" } },
    pages: buildStarterCompositionPages("starter-6", "arch", "menu", "menu-list"),
  },
  {
    id: "starter-7",
    name: "Green Baskerville",
    theme: { palette: "fresh-green", corners: "soft", density: "comfortable", fonts: { heading: { id: "Libre Baskerville", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "tinted", buttonShape: "soft" } },
    pages: buildStarterCompositionPages("starter-7", "offset-frame", "testimonials", "rows"),
  },
  {
    id: "starter-8",
    name: "Studio Oswald",
    theme: { palette: "sunset", corners: "sharp", density: "compact", fonts: { heading: { id: "Oswald", weight: 700 }, body: { id: "Figtree", weight: 400 } }, header: { style: "classic" }, design: { rhythm: "bold", buttonShape: "square" } },
    pages: buildStarterCompositionPages("starter-8", "diagonal", "stats", "compact"),
  },
  {
    id: "starter-9",
    name: "Elegant Cormorant",
    theme: { palette: "berry", corners: "round", density: "airy", fonts: { heading: { id: "Cormorant Garamond", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "centered" }, design: { rhythm: "alternate", buttonShape: "pill" } },
    pages: buildStarterCompositionPages("starter-9", "card-over-image", "features", "mosaic"),
  },
  {
    id: "starter-10",
    name: "Tech Mono",
    theme: { palette: "charcoal", corners: "sharp", density: "comfortable", fonts: { heading: { id: "JetBrains Mono", weight: 700 }, body: { id: "Inter", weight: 400 } }, header: { style: "minimal" }, design: { rhythm: "even", buttonShape: "square" } },
    pages: buildStarterCompositionPages("starter-10", "product-shot", "features", "bento"),
  },
];

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
      seoTitle: "{{businessName}} — Modern software platform",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "sw-hero",
          type: "hero",
          props: {
            layout: "product-shot",
            eyebrow: "Built for fast-moving teams",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Start free trial",
            buttonLink: { type: "url", url: "/pricing" },
            button2Label: "Book a demo",
            button2Link: { type: "url", url: "/contact" },
          },
        },
        {
          id: "sw-stats",
          type: "stats",
          sampleOnly: true,
          props: {
            layout: "compact",
            heading: "Operational benchmarks",
            items: [
              { value: "99.98%", title: "Availability", text: "Multi-region failover SLA." },
              { value: "< 40ms", title: "Edge latency", text: "Fast responses worldwide." },
              { value: "120+", title: "Integrations", text: "Webhooks, SSO, and REST APIs." },
            ],
          },
        },
        {
          id: "sw-features",
          type: "features",
          sampleOnly: true,
          props: {
            layout: "bento",
            heading: "Workflow infrastructure without the busywork",
            items: [
              { title: "Automated routing", text: "Rules evaluate incoming events and trigger teammates automatically." },
              { title: "Granular permissions", text: "Role-scoped workspaces with full audit logs." },
              { title: "Realtime status", text: "Live visibility across every active environment." },
            ],
          },
        },
        {
          id: "sw-cta",
          type: "cta",
          props: {
            layout: "split",
            heading: "Ship faster with {{businessName}}",
            subheading: "{{description}}",
            buttonLabel: "Talk to sales",
            buttonLink: { type: "url", url: "/contact" },
          },
        },
      ],
    },
    {
      key: "product",
      id: "sw-product",
      title: "Platform",
      path: "/platform",
      showInMenu: true,
      seoTitle: "Platform | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: "sw-platform-gallery",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "bento",
            heading: "Core architecture",
            items: [
              { imageId: imgs.section1.id, title: "Workspace controls", text: "Manage teams, tokens, and approvals in one place." },
              { imageId: imgs.section2.id, title: "Live diagnostics", text: "Inspect webhook deliveries and retries instantly." },
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
      seoDescription: "Transparent plans from {{businessName}}",
      blocks: [
        {
          id: "sw-pricing-tiers",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Plans built to scale cleanly",
            items: [
              { title: "Starter", price: "$29/mo", text: "Up to 5 team members and core automations." },
              { title: "Growth", price: "$89/mo", text: "Unlimited workflows, priority queue, and SSO." },
              { title: "Scale", price: "Custom", text: "Dedicated throughput and compliance support." },
            ],
          },
        },
      ],
    },
    {
      key: "faq",
      id: "sw-faq",
      title: "Docs & FAQ",
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
              { title: "How long does onboarding take?", text: "Most teams connect existing tools in under fifteen minutes." },
              { title: "Can we export all workspace data?", text: "Yes, full JSON and CSV exports are always available." },
            ],
          },
        },
      ],
    },
    contactTailPage("sw", "Schedule a walkthrough with {{businessName}}", false),
  ];
}

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
            layout: "arch",
            eyebrow: "Principled Representation",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Book a consultation",
            buttonLink: { type: "url", url: "/contact" },
          },
        },
        {
          id: "law-practice",
          type: "features",
          sampleOnly: true,
          props: {
            layout: "alternating",
            heading: "Areas of practice",
            items: [
              { title: "Commercial & Corporate", text: "Contracts, incorporations, and board governance." },
              { title: "Property & Conveyancing", text: "Title due diligence, leases, and closings." },
              { title: "Dispute Resolution", text: "Mediation and structured settlement strategy." },
            ],
          },
        },
        {
          id: "law-testimonials",
          type: "testimonials",
          sampleOnly: true,
          props: {
            layout: "stacked",
            heading: "Client perspectives",
            items: [
              { quote: "Measured advice at every turn and zero ambiguity on fee terms.", author: "Managing Partner, Hospitality Group" },
            ],
          },
        },
        {
          id: "law-phone",
          type: "text",
          includeIf: "phone",
          props: {
            heading: "Chambers desk",
            text: "Speak directly with our intake desk at {{phone}} ({{hoursNote}}).",
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
              { title: "What happens at the first consultation?", text: "We review relevant agreements and outline practical options in plain language." },
              { title: "How are retainers structured?", text: "Every engagement starts with a clear written scope and fee schedule." },
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
            layout: "rows",
            heading: "Our legal team",
            items: [
              { photoId: imgs.portrait.id, name: "Senior Counsel", role: "Corporate & Commercial Law", text: "Over fifteen years advising regional founders." },
              { photoId: imgs.section1.id, name: "Managing Associate", role: "Real Estate & Regulatory", text: "Focused on clean transactions and compliance." },
            ],
          },
        },
      ],
    },
    contactTailPage("law", "Request a confidential consultation", true),
  ];
}

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
            eyebrow: "Seasonal Table",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Explore menu",
            buttonLink: { type: "url", url: "/menu" },
            button2Label: "Reserve",
            button2Link: { type: "url", url: "/contact" },
          },
        },
        {
          id: "rest-menu-preview",
          type: "menu",
          sampleOnly: true,
          props: {
            layout: "menu-list",
            heading: "From the kitchen tonight",
            items: [
              { title: "Wood-roasted heirloom carrots", price: "$13", text: "Whipped tahini, toasted pistachio, pomegranate glaze." },
              { title: "Charred seabass fillet", price: "$28", text: "Fennel broth, crushed new potatoes, herb oil." },
              { title: "Brown-butter almond tart", price: "$11", text: "Cultured cream and roasted figs." },
            ],
          },
        },
        {
          id: "rest-gallery",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "mosaic",
            heading: "Atmosphere & craft",
            items: [
              { imageId: imgs.section1.id, title: "Dining room" },
              { imageId: imgs.section2.id, title: "Morning bake" },
            ],
          },
        },
        {
          id: "rest-hours",
          type: "text",
          includeIf: "hours",
          props: {
            heading: "Opening hours",
            text: "Join us {{hoursNote}} at {{address}}.",
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
            heading: "Seasonal dishes",
            items: [
              { title: "House sourdough & cultured butter", price: "$8", text: "Stone-ground flour fermented 36 hours." },
              { title: "Braised short rib", price: "$32", text: "Root vegetables, charred shallots, red wine jus." },
              { title: "Citrus olive oil cake", price: "$10", text: "Served warm with mascarpone." },
            ],
          },
        },
      ],
    },
    {
      key: "story",
      id: "rest-story",
      title: "Our Story",
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
          id: "rest-schedule",
          type: "schedule",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Weekly seatings",
            items: [
              { title: "Weekday lunch", time: "11:30am - 2:30pm", text: "Express plates and fresh salads." },
              { title: "Evening dinner", time: "5:30pm - 10:00pm", text: "Full seasonal menu and desserts." },
            ],
          },
        },
      ],
    },
    contactTailPage("rest", "Book a table or private dining", true),
  ];
}

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
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "dev-hero",
          type: "hero",
          props: {
            layout: "minimal",
            eyebrow: "Selected Engineering Work",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Read case studies",
            buttonLink: { type: "url", url: "/work" },
          },
        },
        {
          id: "dev-work-preview",
          type: "features",
          sampleOnly: true,
          props: {
            layout: "stacked",
            heading: "Recent builds",
            items: [
              { title: "Edge checkout pipeline", text: "Cut p99 payment latency by 62% with zero-downtime migration." },
              { title: "Realtime telemetry viewer", text: "Windowed canvas rendering for 50k+ live events per minute." },
            ],
          },
        },
        {
          id: "dev-stats",
          type: "stats",
          sampleOnly: true,
          props: {
            layout: "compact",
            heading: "Track record",
            items: [
              { value: "8+ yrs", title: "Production systems", text: "Distributed backends and React UI." },
              { value: "Zero", title: "Silent failures", text: "Typed contracts and automated checks." },
            ],
          },
        },
      ],
    },
    {
      key: "work",
      id: "dev-work",
      title: "Work",
      path: "/work",
      showInMenu: true,
      seoTitle: "Work | {{businessName}}",
      seoDescription: "Engineering portfolio",
      blocks: [
        {
          id: "dev-work-gallery",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "alternating",
            heading: "Architecture & shipped products",
            items: [
              { imageId: imgs.section1.id, title: "Design system tooling", text: "Accessible primitives shared across six product apps." },
              { imageId: imgs.section2.id, title: "Multi-region workers", text: "Global edge routing and signed webhooks." },
            ],
          },
        },
      ],
    },
    {
      key: "notes",
      id: "dev-notes",
      title: "Writing",
      path: "/notes",
      showInMenu: true,
      seoTitle: "Writing | {{businessName}}",
      seoDescription: "Notes on engineering",
      blocks: [
        {
          id: "dev-notes-text",
          type: "text",
          props: {
            heading: "Technical philosophy",
            text: "{{description}}",
          },
        },
        {
          id: "dev-notes-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Availability & stack",
            items: [
              { title: "What engagements do you take on?", text: "Fractional principal engineering and greenfield builds." },
              { title: "Primary stack?", text: "TypeScript, Postgres, React, and edge workers." },
            ],
          },
        },
      ],
    },
    contactTailPage("dev", "Start a technical project", false),
  ];
}

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
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "salon-hero",
          type: "hero",
          props: {
            layout: "offset-frame",
            eyebrow: "Calm Care & Craft",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Book a visit",
            buttonLink: { type: "url", url: "/contact" },
            button2Label: "Treatment menu",
            button2Link: { type: "url", url: "/treatments" },
          },
        },
        {
          id: "salon-services",
          type: "menu",
          sampleOnly: true,
          props: {
            layout: "menu-list",
            heading: "Popular appointments",
            items: [
              { title: "Signature cut & botanical wash", price: "$65", text: "Consultation, scalp ritual, and natural dry finish." },
              { title: "Restorative gloss & mask", price: "$85", text: "Deep hydration formulated for lasting shine." },
              { title: "Express brow & skin reset", price: "$45", text: "Gentle exfoliation and tailored serum." },
            ],
          },
        },
        {
          id: "salon-team",
          type: "team",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Meet the stylists",
            items: [
              { photoId: imgs.portrait.id, name: "Creative Director", role: "Precision Cuts & Color", text: "Ten years crafting low-maintenance looks." },
              { photoId: imgs.section1.id, name: "Senior Aesthetician", role: "Skin & Scalp Rituals", text: "Botanical care tailored to sensitive skin." },
            ],
          },
        },
      ],
    },
    {
      key: "treatments",
      id: "salon-treatments",
      title: "Treatments",
      path: "/treatments",
      showInMenu: true,
      seoTitle: "Treatments | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: "salon-pricing",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "bento",
            heading: "Care rituals & bundles",
            items: [
              { title: "Seasonal refresh", price: "$110", text: "Wash, tailored trim, and conditioning glaze." },
              { title: "Bridal & event styling", price: "$160", text: "Trial consultation plus day-of finish." },
            ],
          },
        },
      ],
    },
    {
      key: "studio",
      id: "salon-studio",
      title: "The Lounge",
      path: "/lounge",
      showInMenu: true,
      seoTitle: "Lounge | {{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "salon-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Preparing for your visit",
            items: [
              { title: "When should I arrive?", text: "Please arrive ten minutes early to enjoy herbal tea before starting." },
              { title: "Do you carry gentle formulas?", text: "Yes, every wash and serum is sulfate-free and botanical based." },
            ],
          },
        },
      ],
    },
    contactTailPage("salon", "Request an appointment time", true),
  ];
}

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
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "shop-hero",
          type: "hero",
          props: {
            layout: "card-over-image",
            eyebrow: "Curated Goods",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Browse collections",
            buttonLink: { type: "url", url: "/collections" },
          },
        },
        {
          id: "shop-gallery",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "mosaic",
            heading: "Fresh on the shelves",
            items: [
              { imageId: imgs.section1.id, title: "Stoneware vessels", price: "$48" },
              { imageId: imgs.section2.id, title: "Woven table linens", price: "$62" },
              { imageId: imgs.portrait.id, title: "Hand-poured candles", price: "$28" },
            ],
          },
        },
        {
          id: "shop-features",
          type: "features",
          sampleOnly: true,
          props: {
            layout: "compact",
            heading: "Thoughtful shopping",
            items: [
              { title: "Same-day pickup", text: "Order ahead and collect wrapped at the counter." },
              { title: "Small-batch makers", text: "Pieces crafted with natural fibres and glazes." },
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
            layout: "rows",
            heading: "Gift sets & seasonal editions",
            items: [
              { title: "Host gift box", price: "$75", text: "Linen napkin pair, beeswax tapers, and ceramic dish." },
              { title: "Quiet morning set", price: "$58", text: "Hand-thrown mug paired with local roast blend." },
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
          id: "shop-about-text",
          type: "text",
          props: {
            heading: "Behind our shelves",
            text: "{{description}}",
          },
        },
        {
          id: "shop-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Orders & gift wrapping",
            items: [
              { title: "Do you wrap gifts?", text: "Complimentary kraft paper and linen ribbon on every parcel." },
              { title: "Can I hold an item in store?", text: "Send us a quick note and we will set pieces aside for 48 hours." },
            ],
          },
        },
      ],
    },
    contactTailPage("shop", "Ask about stock or gift orders", false),
  ];
}

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
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "hs-hero",
          type: "hero",
          props: {
            layout: "diagonal",
            eyebrow: "Licensed & Local Crew",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Request a quote",
            buttonLink: { type: "url", url: "/contact" },
            button2Label: "See services",
            button2Link: { type: "url", url: "/services" },
          },
        },
        {
          id: "hs-services-grid",
          type: "features",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Fast, tidy home repairs",
            items: [
              { title: "Urgent leak & drain calls", text: "Rapid dispatch across {{areaServed}}." },
              { title: "Planned installations", text: "Fixtures, water heaters, and annual checkups." },
              { title: "Written estimates", text: "Firm pricing agreed before work begins." },
            ],
          },
        },
        {
          id: "hs-before-after",
          type: "before-after",
          sampleOnly: true,
          props: {
            layout: "grid",
            heading: "Recent transformations",
            items: [
              { title: "Utility room repipe", text: "Replaced aging lines with tidy copper manifolds in one day." },
              { title: "Bathroom upgrade", text: "Installed modern thermostatic mixer and sealed vanity." },
            ],
          },
        },
        {
          id: "hs-phone",
          type: "text",
          includeIf: "phone",
          props: {
            heading: "Need help today?",
            text: "Call {{businessName}} on {{phone}} during {{hoursNote}}.",
          },
        },
      ],
    },
    {
      key: "services",
      id: "hs-services",
      title: "Services",
      path: "/services",
      showInMenu: true,
      seoTitle: "Services | {{businessName}}",
      seoDescription: "{{tagline}}",
      blocks: [
        {
          id: "hs-rates",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Transparent service rates",
            items: [
              { title: "Diagnostic visit", price: "$65", text: "Full inspection credited toward approved repair." },
              { title: "Annual tune-up", price: "$125", text: "Preventive inspection checklist and safety test." },
            ],
          },
        },
      ],
    },
    {
      key: "reviews",
      id: "hs-reviews",
      title: "Reviews",
      path: "/reviews",
      showInMenu: true,
      seoTitle: "Reviews | {{businessName}}",
      seoDescription: "Customer reviews",
      blocks: [
        {
          id: "hs-testimonials",
          type: "testimonials",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Trusted by homeowners",
            items: [
              { quote: "Showed up right on the hour, kept floors protected, and fixed it cleanly.", author: "Priya M." },
              { quote: "Clear breakdown of options with zero sales pressure.", author: "Gareth T." },
            ],
          },
        },
        {
          id: "hs-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Service questions",
            items: [
              { title: "Do you carry parts in the van?", text: "Yes, vans are stocked for most common fittings on the first visit." },
              { title: "Which areas do you cover?", text: "We service homes throughout {{areaServed}}." },
            ],
          },
        },
      ],
    },
    contactTailPage("hs", "Request an estimate", true),
  ];
}

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
            eyebrow: "Everyone Welcome",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Plan a visit",
            buttonLink: { type: "url", url: "/visit" },
          },
        },
        {
          id: "ch-schedule",
          type: "schedule",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Weekly gatherings",
            items: [
              { title: "Sunday Gathering", time: "9:30am & 11:15am", text: "Warm welcome, acoustic music, and kids groups." },
              { title: "Midweek Meal", time: "Wednesdays 6:00pm", text: "Community dinner table open to all neighbours." },
              { title: "Youth & Coffee", time: "Fridays 7:00pm", text: "Games, mentorship, and relaxed conversation." },
            ],
          },
        },
        {
          id: "ch-cta",
          type: "cta",
          props: {
            layout: "centered",
            heading: "Rooted in {{areaServed}}",
            subheading: "{{description}}",
            buttonLabel: "Connect with us",
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
      seoDescription: "Sunday details at {{businessName}}",
      blocks: [
        {
          id: "ch-faq",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "First time here?",
            items: [
              { title: "What should I wear?", text: "Come casually and comfortably — whatever feels natural." },
              { title: "Is childcare available?", text: "Yes, safe age-grouped rooms are open during Sunday mornings." },
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
      seoDescription: "Groups and leaders",
      blocks: [
        {
          id: "ch-leaders",
          type: "team",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Neighbours & volunteers",
            items: [
              { photoId: imgs.portrait.id, name: "Community Pastor", role: "Hospitality & Care", text: "Helping newcomers find circles and local support." },
              { photoId: imgs.section1.id, name: "Outreach Coordinator", role: "Neighbourhood Partnerships", text: "Coordinating food pantry and tutoring teams." },
            ],
          },
        },
      ],
    },
    contactTailPage("ch", "Reach our welcome team", false),
  ];
}

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
      seoTitle: "{{businessName}}",
      seoDescription: "{{description}}",
      blocks: [
        {
          id: "cs-hero",
          type: "hero",
          props: {
            layout: "editorial",
            eyebrow: "Design & Direction",
            heading: "{{businessName}}",
            subheading: "{{tagline}}",
            imageId: imgs.hero.id,
            buttonLabel: "Start a brief",
            buttonLink: { type: "url", url: "/contact" },
            button2Label: "Selected projects",
            button2Link: { type: "url", url: "/projects" },
          },
        },
        {
          id: "cs-gallery",
          type: "gallery",
          sampleOnly: true,
          props: {
            layout: "bento",
            heading: "Selected campaigns",
            items: [
              { imageId: imgs.section1.id, title: "Solstice Roasters Identity", text: "Packaging system, typography, and retail signage." },
              { imageId: imgs.section2.id, title: "Wayfinder Annual Report", text: "Editorial print layout and data illustrations." },
              { imageId: imgs.portrait.id, title: "Marrow Ceramics Campaign", text: "Art direction and seasonal lookbook." },
            ],
          },
        },
        {
          id: "cs-services",
          type: "features",
          sampleOnly: true,
          props: {
            layout: "compact",
            heading: "Capabilities",
            items: [
              { title: "Brand systems", text: "Visual identity, type scales, and practical guidelines." },
              { title: "Art direction", text: "Campaign concepting and production direction." },
              { title: "Digital flagships", text: "Editorial websites crafted for speed and clarity." },
            ],
          },
        },
      ],
    },
    {
      key: "projects",
      id: "cs-projects",
      title: "Projects",
      path: "/projects",
      showInMenu: true,
      seoTitle: "Projects | {{businessName}}",
      seoDescription: "Studio portfolio",
      blocks: [
        {
          id: "cs-ba",
          type: "before-after",
          sampleOnly: true,
          props: {
            layout: "alternating",
            heading: "Rebrands & evolutions",
            items: [
              { title: "Harbour Bakery Packaging", text: "Unified six legacy labels into a crisp seasonal grid." },
              { title: "Fieldwork Press Flagship", text: "Redesigned navigation for faster catalog discovery." },
            ],
          },
        },
      ],
    },
    {
      key: "process",
      id: "cs-process",
      title: "Process",
      path: "/process",
      showInMenu: true,
      seoTitle: "Process | {{businessName}}",
      seoDescription: "How we work",
      blocks: [
        {
          id: "cs-pricing",
          type: "pricing",
          sampleOnly: true,
          props: {
            layout: "rows",
            heading: "Studio engagements",
            items: [
              { title: "Identity sprint", price: "$2,800", text: "Three-week focused brand mark and toolkit." },
              { title: "Full flagship direction", price: "$6,400", text: "Identity, art direction, and launch assets." },
            ],
          },
        },
      ],
    },
    {
      key: "faq",
      id: "cs-faq",
      title: "FAQ",
      path: "/faq",
      showInMenu: true,
      seoTitle: "FAQ | {{businessName}}",
      seoDescription: "Working with {{businessName}}",
      blocks: [
        {
          id: "cs-faq-items",
          type: "faq",
          sampleOnly: true,
          props: {
            heading: "Studio questions",
            items: [
              { title: "How far ahead should we book?", text: "We open two new studio slots per month; reach out anytime for availability." },
              { title: "Do you deliver editable files?", text: "Yes, every handoff includes clean vector masters and usage guides." },
            ],
          },
        },
      ],
    },
    contactTailPage("cs", "Tell us about your brief", false),
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
      return buildStarterCompositionPages(slug, "split", "features", "rows");
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
  { slug: "starter", hero: "split", header: "classic", font: "Bricolage Grotesque", bodyFont: "Figtree", corners: "soft", density: "comfortable", buttonShape: "soft", rhythm: "even", palette: "fresh-green", sampleName: "Cedarbrook Neighbourhood Sample", businessTypes: ["local business", "consultant", "general"] },
  { slug: "software-company", hero: "product-shot", header: "classic", font: "Manrope", bodyFont: "Inter", corners: "round", density: "compact", buttonShape: "round", rhythm: "bold", palette: "ocean", sampleName: "Northwind Telemetry Sample", businessTypes: ["software", "saas"] },
  { slug: "law-firm", hero: "arch", header: "centered", font: "Libre Baskerville", bodyFont: "Inter", corners: "sharp", density: "airy", buttonShape: "square", rhythm: "tinted", palette: "midnight", sampleName: "Alder & Associates Chambers", businessTypes: ["law firm", "legal", "accounting"] },
  { slug: "restaurant", hero: "fullbleed", header: "overlay", font: "DM Serif Display", bodyFont: "Figtree", corners: "soft", density: "comfortable", buttonShape: "pill", rhythm: "alternate", palette: "berry", sampleName: "Saffron Copper Hearth Bistro", businessTypes: ["restaurant", "cafe", "bakery"] },
  { slug: "developer-portfolio", hero: "minimal", header: "minimal", font: "JetBrains Mono", bodyFont: "Inter", corners: "sharp", density: "airy", buttonShape: "square", rhythm: "even", palette: "charcoal", sampleName: "Kieran Vale Engineering", businessTypes: ["portfolio", "developer"] },
  { slug: "salon-beauty", hero: "offset-frame", header: "centered", font: "Cormorant Garamond", bodyFont: "Figtree", corners: "round", density: "airy", buttonShape: "pill", rhythm: "alternate", palette: "berry", sampleName: "Camellia Botanical Lounge", businessTypes: ["salon", "beauty", "spa"] },
  { slug: "boutique-shop", hero: "card-over-image", header: "split", font: "Fraunces", bodyFont: "Figtree", corners: "round", density: "comfortable", buttonShape: "round", rhythm: "tinted", palette: "sunset", sampleName: "Loom & Clay Curated Goods", businessTypes: ["shop", "retail", "boutique"] },
  { slug: "home-services", hero: "diagonal", header: "classic", font: "Oswald", bodyFont: "Inter", corners: "sharp", density: "compact", buttonShape: "square", rhythm: "bold", palette: "fresh-green", sampleName: "Oakridge Plumbing & Heating", businessTypes: ["home services", "plumbing", "repair"] },
  { slug: "community-church", hero: "centered", header: "classic", font: "Lora", bodyFont: "Figtree", corners: "soft", density: "airy", buttonShape: "pill", rhythm: "alternate", palette: "ocean", sampleName: "Meadowbrook Community Fellowship", businessTypes: ["church", "nonprofit", "community"] },
  { slug: "creative-studio", hero: "editorial", header: "classic", font: "Space Grotesk", bodyFont: "Inter", corners: "sharp", density: "comfortable", buttonShape: "soft", rhythm: "even", palette: "charcoal", sampleName: "Paperkite Visual Direction", businessTypes: ["creative studio", "agency", "photography"] },
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
