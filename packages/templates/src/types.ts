import type { Block, Theme } from "@get-on/blocks";

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
  phone: string;
  email: string;
  address: string;
  hours: Record<string, string>;
  hoursNote: string;
  social: { network: string; url: string }[];
  logoAssetKey?: string;
};

export type HeaderConfig = {
  logoMode: "name" | "logo";
  menuSource: "pages" | "sections";
  cta?: { label: string; link: any } | null;
  sticky: boolean;
  border: boolean;
  announcement?: string;
};

export type FooterConfig = {
  layout: "simple" | "columns" | "centered";
  showSocial: boolean;
  showContact: boolean;
  showHours: boolean;
  background: "plain" | "soft" | "dark";
};

export type TemplatePage = {
  key: string;
  title: string;
  path: string;
  isHome: boolean;
  showInMenu: boolean;
  menuLabel?: string;
  priority: number;
  dropLinkFallback: "home" | "none";
  seo: { title: string; description: string; noindex?: boolean };
  blocks: Block[];
  blockMeta?: Record<string, { requires?: ("contact")[]; fallback?: Block; includeIf?: "contactForm" | "pictures" }>;
};

export type SinglePage = {
  title: string;
  include: { page: string; blocks: string[] }[];
  anchors: Record<string, { anchor: string; menuLabel?: string }>;
  pageAnchors: Record<string, string>;
  seo: { title: string; description: string };
};

export type Composition = {
  id: string;
  label: string;
  businessTypes?: BusinessType[];
  theme: Theme;
  header: HeaderConfig;
  footer: FooterConfig;
  pages: TemplatePage[];
  singlePage: SinglePage;
};

export type AiHints = {
  brief: string;
  audience: string;
  tone: string[];
  doNot: string[];
  pagePurposes: Record<string, string>;
  blockPurposes: Record<string, string>;
};

export type TemplateAssetDef = {
  key: string;
  alt: string;
  width: number;
  height: number;
  kind: "art" | "photo" | "logo" | "avatar";
};

export type TemplatePackage = {
  packageVersion: 1;
  meta: {
    name: string;
    tagline: string;
    description: string;
    category: Category;
    tags: string[];
    businessTypes: BusinessType[];
    language: "en";
    author: string;
    license: "platform" | "user";
    notices: Notice[];
  };
  sampleProfile: SampleProfile;
  aiHints: AiHints;
  assets: TemplateAssetDef[];
  compositions: Composition[];
};
