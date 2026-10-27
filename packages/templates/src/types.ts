import type { Theme } from "@get-on/blocks";

export type Block = Record<string, any>;

export type Category =
  | "starter"
  | "software"
  | "professional"
  | "restaurant"
  | "shop"
  | "health-beauty"
  | "portfolio"
  | "community"
  | "education"
  | "other";

export type BusinessType =
  | "restaurant"
  | "salon-beauty"
  | "shop"
  | "portfolio"
  | "consultant"
  | "church-community"
  | "repair-services"
  | "farm-agriculture"
  | "education-tutoring"
  | "other";

export type PlanId = "free" | "basic" | "pro" | "enterprise";

export type Notice = { level: "info" | "warn"; text: string };

export type SampleProfile = {
  businessName: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  hoursNote: string;
  social: { network: string; url: string }[];
  businessType?: string;
  city?: string;
  region?: string;
  country?: string;
  areaServed?: string;
  ownerFirstName?: string;
};

export type TemplatePage = {
  key: string;
  title: string;
  path: string;
  isHome: boolean;
  showInMenu: boolean;
  menuLabel?: string;
  priority: number;
  seo: { title: string; description: string };
  blocks: Block[];
};

export type Composition = {
  id: string;
  label: string;
  businessTypes?: BusinessType[];
  theme: Theme;
  pages: TemplatePage[];
};

export type AiHints = {
  brief: string;
  audience: string;
  tone: string[];
  doNot: string[];
  pagePurposes: Record<string, string>;
};

export type TemplateAssetDef = {
  key: string;
  alt: string;
  width: number;
  height: number;
  kind: "art" | "photo" | "logo" | "avatar";
};

export type TemplateMeta = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  tags: string[];
  businessTypes: BusinessType[];
  author: string;
  license: "platform" | "user";
  planMin: PlanId;
  featured: boolean;
  notices: Notice[];
};

export type TemplatePackage = {
  packageVersion: 1;
  meta: TemplateMeta;
  sampleProfile: SampleProfile;
  aiHints: AiHints;
  assets: TemplateAssetDef[];
  compositions: Composition[];
};

export type TemplateCatalogItem = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  tags: string[];
  businessTypes: BusinessType[];
  planMin: PlanId;
  featured: boolean;
  pageCount: number;
  colors: { primary: string; accent: string; background: string; text: string; soft: string };
  preview: { eyebrow: string; heading: string; subheading: string; items: string[] };
};
