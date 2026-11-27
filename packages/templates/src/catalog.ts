export type TemplateCatalogItem = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags?: string[];
  planMin: "free" | "basic" | "pro" | "enterprise";
  pageCount: number;
  featured: boolean;
  colors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
    soft: string;
  };
  preview: {
    eyebrow: string;
    heading: string;
    subheading: string;
    items: string[];
  };
};

export const TEMPLATE_CATALOG: TemplateCatalogItem[] = [
  {
    slug: "starter",
    name: "Haven",
    tagline: "Warm, adaptable flagship layout for neighbourhood businesses and studios.",
    description:
      "Balanced offset-frame photography, clear service cards, and direct local inquiry paths built to introduce your business fast.",
    category: "starter",
    tags: ["Local business", "Offset frame", "Bricolage Grotesque"],
    planMin: "free",
    pageCount: 4,
    featured: true,
    colors: {
      primary: "#0B6B4F",
      accent: "#F59E0B",
      background: "#FFFBF5",
      text: "#1F1A17",
      soft: "#F0F7F4",
    },
    preview: {
      eyebrow: "Starter · Haven",
      heading: "A warm, dependable home online",
      subheading: "Offset photo framing, service cards, and a direct neighbourhood inquiry flow.",
      items: ["Services", "Stories", "Contact"],
    },
  },
  {
    slug: "software-company",
    name: "Pulse",
    tagline: "Near-black tech startup canvas with electric violet, cyan glow, and glass bento cards.",
    description:
      "Product-first SaaS architecture with dark gradient glow, interactive monthly/annual pricing, 3-step onboarding, and bento feature snippets.",
    category: "software",
    tags: ["SaaS & Tech", "Glassmorphism", "Space Grotesk"],
    planMin: "basic",
    pageCount: 5,
    featured: true,
    colors: {
      primary: "#6847F5",
      accent: "#22D3EE",
      background: "#0B0D17",
      text: "#F5F7FF",
      soft: "#14182D",
    },
    preview: {
      eyebrow: "SaaS · Pulse",
      heading: "Automate workflows at edge speed",
      subheading: "Dark product framing, bento snippets, and monthly/annual pricing toggle.",
      items: ["Bento", "3 Steps", "Toggle Pricing"],
    },
  },
  {
    slug: "law-firm",
    name: "Meridian",
    tagline: "Deep navy, ivory, and brushed brass legal template with timeless serif authority.",
    description:
      "Centered brass-ruled header with visible phone line, deep navy statement hero, trust bar metrics, 3-column practice areas, and attorney profiles.",
    category: "professional",
    tags: ["Law Firm", "Square corners", "Libre Caslon Text"],
    planMin: "basic",
    pageCount: 4,
    featured: true,
    colors: {
      primary: "#0F1F3D",
      accent: "#B08D57",
      background: "#FAF8F3",
      text: "#0F1F3D",
      soft: "#EFECE3",
    },
    preview: {
      eyebrow: "Legal · Meridian",
      heading: "Clarity in complex matters",
      subheading: "Navy statement block, brass rules, trust metrics, and formal counsel profiles.",
      items: ["Trust Bar", "6 Practice Areas", "Counsel"],
    },
  },
  {
    slug: "restaurant",
    name: "Ember",
    tagline: "Charcoal, terracotta, and cream hospitality template with tabbed courses.",
    description:
      "Warm overlay header, tabbed seasonal menu (Starters, Mains, Desserts, Drinks) with featured dish photography, gallery strip, and terracotta reservation band.",
    category: "restaurant",
    tags: ["Restaurant", "Tabbed Menu", "DM Serif Display"],
    planMin: "free",
    pageCount: 4,
    featured: true,
    colors: {
      primary: "#B2462E",
      accent: "#C8553D",
      background: "#1E1A18",
      text: "#F6EBDD",
      soft: "#2A2421",
    },
    preview: {
      eyebrow: "Dining · Ember",
      heading: "Fire-kissed plates, warm evenings",
      subheading: "Charcoal dining palette, interactive course tabs, and table reservations.",
      items: ["Course Tabs", "Chef Story", "Reserve"],
    },
  },
  {
    slug: "developer-portfolio",
    name: "Concrete",
    tagline: "Swiss architectural & technical studio layout on raw 12-column grid lines.",
    description:
      "Oversized condensed grotesk headlines, IBM Plex Mono coordinates, numbered index project rows, horizontal case-study strip, and signal orange call-to-action.",
    category: "portfolio",
    tags: ["Architecture & Studio", "12-Col Grid", "Anton + Mono"],
    planMin: "free",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#0A0A0A",
      accent: "#FF4F00",
      background: "#D9D9D6",
      text: "#0A0A0A",
      soft: "#E7E7E4",
    },
    preview: {
      eyebrow: "Architecture · Concrete",
      heading: "FORM FOLLOWS PRECISION",
      subheading: "Visible 12-column structural lines, numbered index list, and crisp orange markers.",
      items: ["01 Index", "Plans Strip", "Studio Table"],
    },
  },
  {
    slug: "salon-beauty",
    name: "Willow",
    tagline: "Calm sage, warm sand, and blush wellness studio with arched imagery and timetable.",
    description:
      "Breathing pastel arch hero, weekly timetable schedule, circular instructor portraits, three-tier membership with highlighted plan, and studio newsletter.",
    category: "professional",
    tags: ["Wellness & Yoga", "Arch Frames", "Fraunces"],
    planMin: "basic",
    pageCount: 4,
    featured: true,
    colors: {
      primary: "#2F3E36",
      accent: "#A8B5A0",
      background: "#EFE6DA",
      text: "#2F3E36",
      soft: "#E8CFC4",
    },
    preview: {
      eyebrow: "Wellness · Willow",
      heading: "Breathe deeply. Move gently.",
      subheading: "Soft sage arches, weekly class timetable, and tranquil membership tiers.",
      items: ["Timetable", "Instructors", "Memberships"],
    },
  },
  {
    slug: "boutique-shop",
    name: "Bloom & Bold",
    tagline: "Editorial floral & independent makers storefront with overlapping story cards.",
    description:
      "High-contrast fashion serif typography, asymmetric card-over-image hero, categorized seasonal collections, workshop bookings, and direct pickup notes.",
    category: "starter",
    tags: ["Florist & Shop", "Card Over Image", "Bodoni Moda"],
    planMin: "basic",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#9F2D3A",
      accent: "#D97706",
      background: "#FFFDF8",
      text: "#1E1716",
      soft: "#FAEDE8",
    },
    preview: {
      eyebrow: "Atelier · Bloom & Bold",
      heading: "Seasonal stems & tactile objects",
      subheading: "Card-over-image showcase, collection tabs, and workshop calendar.",
      items: ["Bouquets", "Plants", "Workshops"],
    },
  },
  {
    slug: "home-services",
    name: "Clearview",
    tagline: "Pure white and aqua teal clinic layout with expandable treatments and result slider.",
    description:
      "Welcoming split hero with direct appointment phone line, quick emergency/insurance strip, expandable service cards, clinician credentials, and before/after slider.",
    category: "professional",
    tags: ["Dental & Clinic", "Expandable Cards", "Poppins"],
    planMin: "free",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#1F8582",
      accent: "#2BA8A4",
      background: "#FFFFFF",
      text: "#1D3557",
      soft: "#E6F6F4",
    },
    preview: {
      eyebrow: "Clinic · Clearview",
      heading: "Gentle care for healthy smiles",
      subheading: "Aqua teal clarity, expandable treatment cards, and before/after comparison.",
      items: ["Quick Info", "Expandable Care", "Results Slider"],
    },
  },
  {
    slug: "community-church",
    name: "Sprout",
    tagline: "Friendly neighbourhood & youth hub with open schedules, programs, and welcome FAQ.",
    description:
      "Playful rounded typography on sunlit meadow tones, centered welcome hero, weekly gathering schedule tabs, volunteer leaders, and clear newcomer guidance.",
    category: "starter",
    tags: ["Community & Youth", "Warm & Rounded", "Baloo 2"],
    planMin: "free",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#1F6E4D",
      accent: "#F59E0B",
      background: "#FFFCF3",
      text: "#1A2E23",
      soft: "#E7F5ED",
    },
    preview: {
      eyebrow: "Community · Sprout",
      heading: "A bright place to grow together",
      subheading: "Weekly programs, open community meals, and welcoming first-visit guides.",
      items: ["Programs", "Gatherings", "Volunteers"],
    },
  },
  {
    slug: "creative-studio",
    name: "Frame",
    tagline: "Quiet gallery-grade visual portfolio in off-white, ink black, and warm taupe.",
    description:
      "Minimal top header, oversized Cormorant Garamond editorial headline, asymmetric masonry showcase, full-width project sequences, split bio, and direct email CTA.",
    category: "portfolio",
    tags: ["Photography & Gallery", "Masonry Grid", "Cormorant Garamond"],
    planMin: "pro",
    pageCount: 5,
    featured: true,
    colors: {
      primary: "#111111",
      accent: "#B5A58A",
      background: "#F5F4F0",
      text: "#111111",
      soft: "#ECEAE3",
    },
    preview: {
      eyebrow: "Portfolio · Frame",
      heading: "Stillness held in natural light",
      subheading: "Gallery-white editorial pacing, masonry studies, and whisper-quiet dividers.",
      items: ["Masonry Work", "Sequences", "Split Bio"],
    },
  },
];
