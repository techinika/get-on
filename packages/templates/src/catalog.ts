import type { TemplateCatalogItem, TemplateMeta } from "./types";

export type { TemplateCatalogItem } from "./types";

const CATALOG: TemplateCatalogItem[] = [

  {
    slug: "salon-beauty",
    name: "Salon and beauty",
    tagline: "A soft, elegant website for a salon or beauty studio.",
    description:
      "A calm design for hair, skin and nail care. Show treatments, introduce the team and make booking feel unhurried.",
    category: "health-beauty",
    tags: ["salon", "beauty", "booking", "soft"],
    businessTypes: ["salon-beauty"],
    planMin: "basic",
    featured: true,
    pageCount: 4,
    colors: { primary: "#8E4A5D", accent: "#B5835A", background: "#FFF9F6", text: "#2E2024", soft: "#F8E9E6" },
    preview: {
      eyebrow: "Salon and beauty",
      heading: "Care that makes you feel like yourself",
      subheading: "A quiet studio for considered hair, skin and nail care.",
      items: ["Treatments", "The studio", "Book a visit"],
    },
  },
  {
    slug: "boutique-shop",
    name: "Boutique shop",
    tagline: "A product-first website for a small shop.",
    description:
      "A warm retail design for a curated shop. Show products, tell the story behind them and make visiting or asking a question easy.",
    category: "shop",
    tags: ["shop", "products", "retail", "editorial"],
    businessTypes: ["shop"],
    planMin: "basic",
    featured: true,
    pageCount: 4,
    colors: { primary: "#1C1B1A", accent: "#C2410C", background: "#F7F3EE", text: "#151412", soft: "#ECE5DB" },
    preview: {
      eyebrow: "Boutique shop",
      heading: "Things worth keeping",
      subheading: "A small edit of useful objects, chosen with care.",
      items: ["The shop", "Our story", "Visit us"],
    },
  },
  {
    slug: "home-services",
    name: "Home services",
    tagline: "A bold, trustworthy website for local trades.",
    description:
      "A direct design for repairs, improvements and home services. Put the phone number first, explain the work and make quoting simple.",
    category: "professional",
    tags: ["trades", "repairs", "local", "bold"],
    businessTypes: ["repair-services"],
    planMin: "basic",
    featured: true,
    pageCount: 4,
    colors: { primary: "#0A58CA", accent: "#FF7A00", background: "#FFFFFF", text: "#0F172A", soft: "#EAF2FF" },
    preview: {
      eyebrow: "Home services",
      heading: "The job done properly, first time",
      subheading: "Clear quotes, tidy work and a local team.",
      items: ["Services", "Recent work", "Contact the team"],
    },
  },
  {
    slug: "community-church",
    name: "Community and church",
    tagline: "A warm, welcoming website for a community.",
    description:
      "A calm design for a church or community group. Welcome people, explain what happens and make the first visit feel easy.",
    category: "community",
    tags: ["community", "church", "welcome", "events"],
    businessTypes: ["church-community"],
    planMin: "free",
    featured: false,
    pageCount: 4,
    colors: { primary: "#355E4B", accent: "#D9A441", background: "#FFFBF2", text: "#25302B", soft: "#EEF3E7" },
    preview: {
      eyebrow: "Community and church",
      heading: "There is room for you here",
      subheading: "A warm community with space for questions, quiet and company.",
      items: ["What to expect", "Gatherings", "Plan a visit"],
    },
  },
  {
    slug: "creative-studio",
    name: "Creative studio",
    tagline: "An editorial, high-contrast website for a studio.",
    description:
      "A bold design for designers, makers and creative teams. Lead with the work, explain the thinking and make starting a project simple.",
    category: "portfolio",
    tags: ["studio", "creative", "portfolio", "editorial"],
    businessTypes: ["portfolio", "consultant"],
    planMin: "basic",
    featured: true,
    pageCount: 4,
    colors: { primary: "#0A0A0A", accent: "#FF4D2E", background: "#FFFFFF", text: "#0A0A0A", soft: "#F2F2F0" },
    preview: {
      eyebrow: "Creative studio",
      heading: "Make the idea impossible to ignore",
      subheading: "Brand, digital and campaign work with a clear point of view.",
      items: ["Selected work", "The studio", "Start a project"],
    },
  },
  {
    slug: "starter",
    name: "Starter",
    tagline: "A friendly, flexible website for any small business.",
    description:
      "A clean starting point with a welcome section, what you offer, a little about you and an easy way for people to get in touch. Works well for almost any business.",
    category: "starter",
    tags: ["simple", "friendly", "flexible", "default"],
    businessTypes: ["other", "consultant", "shop", "repair-services", "farm-agriculture"],
    planMin: "free",
    featured: true,
    pageCount: 4,
    colors: { primary: "#0B6B4F", accent: "#F59E0B", background: "#FFFBF7", text: "#1F1A17", soft: "#F0F7F4" },
    preview: {
      eyebrow: "Small business, big welcome",
      heading: "A simple website that feels like you",
      subheading: "Tell people what you do, show what you offer and make it easy to get in touch.",
      items: ["What you offer", "About your business", "Contact details"],
    },
  },
  {
    slug: "software-company",
    name: "Software company",
    tagline: "A clear, modern website for a software product.",
    description:
      "Explain what your product does, show how it works, share pricing and answer common questions. Built for software teams that want a calm, confident website.",
    category: "software",
    tags: ["saas", "product", "pricing", "modern"],
    businessTypes: ["other", "consultant"],
    planMin: "basic",
    featured: true,
    pageCount: 5,
    colors: { primary: "#3730A3", accent: "#14B8A6", background: "#FFFFFF", text: "#1B1A33", soft: "#F4F3FF" },
    preview: {
      eyebrow: "Software made simple",
      heading: "Work together, without the busywork",
      subheading: "One calm place for your team to plan, share and get things done.",
      items: ["Product features", "Simple pricing", "Questions answered"],
    },
  },
  {
    slug: "law-firm",
    name: "Law firm",
    tagline: "A calm, trustworthy website for a law firm.",
    description:
      "Put people at ease with clear practice areas, a warm introduction to your team and simple ways to book a first conversation.",
    category: "professional",
    tags: ["legal", "professional", "trust", "services"],
    businessTypes: ["consultant", "other"],
    planMin: "basic",
    featured: false,
    pageCount: 5,
    colors: { primary: "#3B5B8C", accent: "#B8945F", background: "#F7F9FC", text: "#172033", soft: "#EEF2F8" },
    preview: {
      eyebrow: "Clear advice. Steady support.",
      heading: "Pragmatic legal help when it matters most",
      subheading: "Friendly legal guidance explained in plain language.",
      items: ["Practice areas", "Our approach", "Book a conversation"],
    },
  },
  {
    slug: "restaurant",
    name: "Restaurant",
    tagline: "A warm website for a restaurant, cafe or food business.",
    description:
      "Show your menu, opening hours and contact details in a design that makes people hungry. Perfect for cafes, restaurants and small food businesses.",
    category: "restaurant",
    tags: ["food", "menu", "hours", "warm"],
    businessTypes: ["restaurant"],
    planMin: "free",
    featured: true,
    pageCount: 6,
    colors: { primary: "#B8472B", accent: "#D97706", background: "#FFFBF7", text: "#2A1A14", soft: "#FBF3ED" },
    preview: {
      eyebrow: "Freshly made, served with love",
      heading: "A table worth sharing",
      subheading: "Good food, friendly faces and a warm welcome. Come and see us.",
      items: ["Our menu", "Our story", "Find us"],
    },
  },
  {
    slug: "developer-portfolio",
    name: "Developer portfolio",
    tagline: "A focused website for a developer or designer.",
    description:
      "Show selected work, explain how you approach projects and make it easy for people to start a conversation. Simple, personal and fast.",
    category: "portfolio",
    tags: ["portfolio", "developer", "work", "personal"],
    businessTypes: ["portfolio"],
    planMin: "free",
    featured: false,
    pageCount: 4,
    colors: { primary: "#1F2937", accent: "#D97706", background: "#FFFFFF", text: "#111827", soft: "#F9FAFB" },
    preview: {
      eyebrow: "Designer & Developer",
      heading: "I build websites that feel as good as they look",
      subheading: "A selection of projects I am proud of and how we can work together.",
      items: ["Selected work", "How I can help", "Get in touch"],
    },
  },
];

export const TEMPLATE_CATALOG = CATALOG;

export function catalogItem(slug: string): TemplateCatalogItem | undefined {
  return CATALOG.find((item) => item.slug === slug);
}

export function metaFor(slug: string): TemplateMeta {
  const item = catalogItem(slug);
  if (!item) throw new Error(`Unknown template: ${slug}`);
  return {
    slug: item.slug,
    name: item.name,
    tagline: item.tagline,
    description: item.description,
    category: item.category,
    tags: item.tags,
    businessTypes: item.businessTypes,
    author: "Get-On",
    license: "platform",
    planMin: item.planMin,
    featured: item.featured,
    notices: [],
  };
}
