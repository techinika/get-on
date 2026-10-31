"use client";

import {
  AlignLeft,
  Box,
  Columns3,
  CreditCard,
  GalleryHorizontal,
  Grid3X3,
  Heading,
  Image as ImageIcon,
  LayoutPanelTop,
  List,
  ListChecks,
  Copy,
  MessageSquare,
  Minus,
  MousePointerClick,
  PanelTop,
  Play,
  Quote,
  Rows3,
  Sparkles,
  Star,
  Text,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NodeType } from "@get-on/blocks";

export const NODE_ICONS: Record<string, LucideIcon> = {
  page: LayoutPanelTop,
  section: LayoutPanelTop,
  container: Box,
  stack: Rows3,
  columns: Columns3,
  column: Columns3,
  grid: Grid3X3,
  heading: Heading,
  text: Text,
  list: List,
  image: ImageIcon,
  button: MousePointerClick,
  divider: Minus,
  spacer: Minus,
  video: Play,
  icon: Star,
  accordion: ListChecks,
  "accordion-item": ListChecks,
  form: MessageSquare,
  html: PanelTop,
  field: Sparkles,
  smart: Sparkles,
  reference: Copy,
};

export type ElementDef = {
  type: NodeType;
  label: string;
  icon: LucideIcon;
  group: "Layout" | "Text" | "Media" | "Actions" | "Advanced";
  props?: Record<string, unknown>;
};

export const ELEMENTS: ElementDef[] = [
  { type: "section", label: "Section", icon: LayoutPanelTop, group: "Layout" },
  { type: "container", label: "Container", icon: Box, group: "Layout" },
  { type: "stack", label: "Stack", icon: Rows3, group: "Layout" },
  { type: "columns", label: "Row", icon: Columns3, group: "Layout" },
  { type: "grid", label: "Grid", icon: Grid3X3, group: "Layout" },
  { type: "spacer", label: "Spacer", icon: Minus, group: "Layout" },
  { type: "divider", label: "Divider", icon: Minus, group: "Layout" },
  { type: "heading", label: "Heading", icon: Heading, group: "Text" },
  { type: "text", label: "Paragraph", icon: Text, group: "Text" },
  { type: "list", label: "List", icon: List, group: "Text" },
  { type: "text", label: "Quote", icon: Quote, group: "Text", props: { text: "“A short quote.”" } },
  { type: "image", label: "Image", icon: ImageIcon, group: "Media" },
  { type: "icon", label: "Icon", icon: Star, group: "Media" },
  { type: "video", label: "Video", icon: Play, group: "Media" },
  { type: "button", label: "Button", icon: MousePointerClick, group: "Actions" },
  { type: "accordion", label: "Accordion", icon: ListChecks, group: "Actions" },
  { type: "html", label: "HTML", icon: PanelTop, group: "Advanced" },
];

export type SmartSectionDef = {
  kind: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const SMART_SECTIONS: SmartSectionDef[] = [
  { kind: "hero", label: "Hero", icon: Sparkles, description: "A big opening with a clear next step." },
  { kind: "features", label: "Features", icon: AlignLeft, description: "What you offer, in a tidy grid." },
  { kind: "image-text", label: "Picture and text", icon: ImageIcon, description: "A picture beside a short story." },
  { kind: "services", label: "Services", icon: List, description: "Your services with short descriptions." },
  { kind: "testimonials", label: "Reviews", icon: Quote, description: "What happy customers say." },
  { kind: "faq", label: "Questions", icon: MessageSquare, description: "Answers to common questions." },
  { kind: "cta", label: "Call to action", icon: MousePointerClick, description: "One clear ask at the end." },
  { kind: "gallery", label: "Gallery", icon: GalleryHorizontal, description: "A set of pictures." },
  { kind: "pricing", label: "Prices", icon: CreditCard, description: "Plans side by side." },
  { kind: "team", label: "Team", icon: Users, description: "The people behind the business." },
  { kind: "stats", label: "Numbers", icon: ListChecks, description: "A few numbers worth showing." },
  { kind: "contact-form", label: "Contact form", icon: MessageSquare, description: "Let people send a message." },
];

export type PatternDef = {
  id: string;
  label: string;
  description: string;
  category: string;
  kinds: string[];
};

export const PATTERNS: PatternDef[] = [
  {
    id: "landing",
    label: "Simple landing page",
    description: "A clear opening, what you offer, and one ask.",
    category: "Pages",
    kinds: ["hero", "features", "cta"],
  },
  {
    id: "about",
    label: "About page",
    description: "Your story, a few numbers, and the people behind it.",
    category: "Pages",
    kinds: ["image-text", "stats", "team", "cta"],
  },
  {
    id: "services",
    label: "Services page",
    description: "Services, proof from customers, and common questions.",
    category: "Pages",
    kinds: ["hero", "services", "testimonials", "faq", "cta"],
  },
  {
    id: "contact",
    label: "Contact page",
    description: "A short welcome and a form people can send.",
    category: "Pages",
    kinds: ["hero", "contact-form"],
  },
  {
    id: "pricing",
    label: "Prices page",
    description: "Plans side by side, with answers to worries.",
    category: "Pages",
    kinds: ["hero", "pricing", "faq", "cta"],
  },
  {
    id: "portfolio",
    label: "Work gallery",
    description: "Show pictures of your work and how to reach you.",
    category: "Sections",
    kinds: ["hero", "gallery", "cta"],
  },
];

export const ELEMENT_GROUPS = ["Layout", "Text", "Media", "Actions", "Advanced"] as const;

export function elementIcon(type: NodeType): LucideIcon {
  return NODE_ICONS[type] ?? Box;
}

export function nodeLabel(node: { type: NodeType; props?: Record<string, unknown> }): string {
  if (node.type === "smart") {
    const kind = String(node.props?.kind ?? "");
    return SMART_SECTIONS.find((item) => item.kind === kind)?.label ?? "Saved section";
  }
  if (node.type === "heading" || node.type === "text") {
    const text = String(node.props?.text ?? "").trim();
    if (text) return text.length > 32 ? `${text.slice(0, 32)}…` : text;
  }
  if (node.type === "button") {
    const label = String(node.props?.label ?? "").trim();
    if (label) return label;
  }
  const found = ELEMENTS.find((item) => item.type === node.type);
  return found?.label ?? node.type;
}
