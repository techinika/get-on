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
    name: "Local Starter",
    tagline: "Warm, adaptable pages for everyday businesses and services.",
    description:
      "A clear, balanced website layout designed to introduce your business, explain what you offer, and help customers reach you fast.",
    category: "starter",
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
      eyebrow: "Starter",
      heading: "A clear home for your business online",
      subheading: "Introduce your services, answer common questions, and invite enquiries.",
      items: ["Services", "About", "Contact"],
    },
  },
  {
    slug: "software-company",
    name: "SaaS & Software",
    tagline: "Crisp product framing built for modern software teams.",
    description:
      "Showcase your product architecture, highlight key workflows, compare pricing tiers, and convert sign-ups cleanly.",
    category: "software",
    planMin: "basic",
    pageCount: 5,
    featured: true,
    colors: {
      primary: "#0369A1",
      accent: "#06B6D4",
      background: "#F8FAFC",
      text: "#0F172A",
      soft: "#E0F2FE",
    },
    preview: {
      eyebrow: "Software",
      heading: "Ship faster with confidence",
      subheading: "Structured workflows, transparent plans, and straightforward onboarding.",
      items: ["Product", "Pricing", "Docs"],
    },
  },
  {
    slug: "law-firm",
    name: "Chambers & Legal",
    tagline: "Measured serif typography with calm editorial authority.",
    description:
      "Tailored for legal practices, advisory firms, and consultants who value clarity, trust, and discretion.",
    category: "professional",
    planMin: "basic",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#1E3A8A",
      accent: "#D97706",
      background: "#FCFBF8",
      text: "#18181B",
      soft: "#EFF6FF",
    },
    preview: {
      eyebrow: "Legal",
      heading: "Practical counsel when decisions matter",
      subheading: "Experienced representation across commercial, property, and advisory matters.",
      items: ["Practice Areas", "Team", "Consult"],
    },
  },
  {
    slug: "restaurant",
    name: "Bistro & Kitchen",
    tagline: "Inviting food storytelling with menus and table booking notes.",
    description:
      "Put seasonal dishes, opening hours, and location front and center with warm editorial pacing.",
    category: "restaurant",
    planMin: "free",
    pageCount: 4,
    featured: true,
    colors: {
      primary: "#9D174D",
      accent: "#F59E0B",
      background: "#FFFDF9",
      text: "#27141D",
      soft: "#FCE7F3",
    },
    preview: {
      eyebrow: "Hospitality",
      heading: "Fresh kitchen plates shared daily",
      subheading: "Seasonal ingredients, friendly service, and easy reservations.",
      items: ["Menu", "Hours", "Book"],
    },
  },
  {
    slug: "developer-portfolio",
    name: "Engineer Portfolio",
    tagline: "Monospace precision for builders, makers, and technical consultants.",
    description:
      "Highlight shipped systems, open-source projects, writing, and direct availability without fluff.",
    category: "portfolio",
    planMin: "free",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#1F2937",
      accent: "#10B981",
      background: "#FAFAFA",
      text: "#111827",
      soft: "#F3F4F6",
    },
    preview: {
      eyebrow: "Portfolio",
      heading: "Reliable web systems & tools",
      subheading: "Full-stack architecture, clean APIs, and thoughtful interfaces.",
      items: ["Projects", "Stack", "Hire"],
    },
  },
  {
    slug: "salon-beauty",
    name: "Studio & Wellness",
    tagline: "Graceful serif rhythm designed for salons, spas, and studios.",
    description:
      "Present treatment menus, practitioner profiles, and studio atmosphere in a serene editorial flow.",
    category: "professional",
    planMin: "basic",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#9D174D",
      accent: "#F43F5E",
      background: "#FFF9FB",
      text: "#27141D",
      soft: "#FCE7F3",
    },
    preview: {
      eyebrow: "Wellness",
      heading: "Unhurried care in a calm space",
      subheading: "Tailored treatments, natural products, and welcoming specialists.",
      items: ["Treatments", "Gallery", "Visit"],
    },
  },
  {
    slug: "boutique-shop",
    name: "Boutique Goods",
    tagline: "Warm showcase cards tailored for independent shops and makers.",
    description:
      "Spotlight curated collections, store story, and stockist info with inviting colour accents.",
    category: "starter",
    planMin: "basic",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#C2410C",
      accent: "#F59E0B",
      background: "#FFFBF7",
      text: "#291810",
      soft: "#FFEDD5",
    },
    preview: {
      eyebrow: "Retail",
      heading: "Thoughtful objects made to last",
      subheading: "Small-batch goods curated for everyday living.",
      items: ["Collection", "Story", "Stockists"],
    },
  },
  {
    slug: "home-services",
    name: "Trade & Home Services",
    tagline: "Direct, trustworthy layout for contractors, repairs, and local trades.",
    description:
      "Built for fast phone inquiries, clear service areas, guarantees, and upfront quote requests.",
    category: "starter",
    planMin: "free",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#0B6B4F",
      accent: "#F59E0B",
      background: "#FFFBF5",
      text: "#1F1A17",
      soft: "#F0F7F4",
    },
    preview: {
      eyebrow: "Home Services",
      heading: "Dependable work done right on time",
      subheading: "Licensed local trades serving homes and businesses nearby.",
      items: ["Services", "Areas", "Quote"],
    },
  },
  {
    slug: "community-church",
    name: "Community & Gathering",
    tagline: "Welcoming layout for congregations, charities, and civic groups.",
    description:
      "Share gathering times, community programs, leadership, and ways to get involved.",
    category: "starter",
    planMin: "free",
    pageCount: 4,
    featured: false,
    colors: {
      primary: "#0369A1",
      accent: "#06B6D4",
      background: "#F8FAFC",
      text: "#0F172A",
      soft: "#E0F2FE",
    },
    preview: {
      eyebrow: "Community",
      heading: "Everyone has a place at the table",
      subheading: "Weekly gatherings, local outreach, and neighbourhood support.",
      items: ["Gatherings", "Programs", "Connect"],
    },
  },
  {
    slug: "creative-studio",
    name: "Creative Studio",
    tagline: "Expressive studio showcase for agencies, photographers, and designers.",
    description:
      "Put selected work, process notes, and collaboration inquiries into an editorial grid.",
    category: "portfolio",
    planMin: "pro",
    pageCount: 5,
    featured: true,
    colors: {
      primary: "#1F2937",
      accent: "#F59E0B",
      background: "#FAFAFA",
      text: "#111827",
      soft: "#F3F4F6",
    },
    preview: {
      eyebrow: "Creative",
      heading: "Design & direction with character",
      subheading: "Identity systems, digital craft, and visual storytelling.",
      items: ["Work", "Studio", "Contact"],
    },
  },
];
