import { createBlock, createId, type Theme, type ThemeDesign, type ThemeFooter, type ThemeHeader } from "@get-on/blocks";
import type { Block, TemplatePage } from "./types";

export function b(type: string, props: Record<string, unknown> = {}, sec?: Record<string, unknown>): Block {
  const created = createBlock(type);
  const { includeIf, slotMeta, ...section } = sec ?? {};
  return {
    ...created,
    props: { ...(created.props ?? {}), ...props },
    ...(Object.keys(section).length > 0 ? { sec: { ...(created.sec ?? {}), ...section } } : {}),
    ...(includeIf ? { includeIf } : {}),
    ...(slotMeta ? { slotMeta } : {}),
  };
}

export function textDoc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export function page(input: {
  key: string;
  title: string;
  path?: string;
  home?: boolean;
  menu?: boolean;
  menuLabel?: string;
  priority?: number;
  seoTitle?: string;
  description?: string;
  blocks: Block[];
}): TemplatePage {
  return {
    key: input.key,
    title: input.title,
    path: input.path ?? "/",
    isHome: input.home ?? false,
    showInMenu: input.menu ?? true,
    menuLabel: input.menuLabel ?? input.title,
    priority: input.priority ?? 0,
    seo: {
      title: input.seoTitle ?? input.title,
      description: input.description ?? "",
    },
    blocks: input.blocks,
  };
}

export function theme(input: {
  primary: string;
  accent: string;
  background: string;
  text: string;
  soft: string;
  heading: string;
  body: string;
  corners?: Theme["corners"];
  density?: Theme["density"];
  buttonShape?: NonNullable<Theme["buttons"]>["shape"];
  buttonSize?: NonNullable<Theme["buttons"]>["size"];
  buttonStyle?: NonNullable<Theme["buttons"]>["style"];
  buttonUppercase?: boolean;
  buttonShadow?: boolean;
  cardStyle?: NonNullable<Theme["cards"]>["style"];
  scale?: NonNullable<Theme["fonts"]>["scale"];
  headingWeight?: number;
  bodyWeight?: number;
  design?: ThemeDesign;
  header?: ThemeHeader;
  footer?: ThemeFooter;
  cardinal?: boolean;
}): Theme {
  return {
    version: 2,
    colors: {
      primary: input.primary,
      accent: input.accent,
      background: input.background,
      text: input.text,
      soft: input.soft,
    },
    fonts: {
      heading: { id: input.heading, weight: input.headingWeight ?? 700 },
      body: { id: input.body, weight: input.bodyWeight ?? 400 },
      scale: input.scale ?? "comfortable",
    },
    buttons: {
      shape: input.buttonShape ?? "soft",
      style: input.buttonStyle ?? "solid",
      size: input.buttonSize ?? "normal",
      uppercase: input.buttonUppercase ?? false,
      shadow: input.buttonShadow ?? false,
    },
    cards: { style: input.cardStyle ?? "outlined" },
    corners: input.corners ?? "soft",
    density: input.density ?? "comfortable",
    colorMode: "light",
    ...(input.design ? { design: input.design } : {}),
    ...(input.header ? { header: input.header } : {}),
    ...(input.footer ? { footer: input.footer } : {}),
  };
}

export function freshId(): string {
  return createId();
}
