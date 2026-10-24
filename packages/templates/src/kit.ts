import { createBlock, createId, type Theme } from "@get-on/blocks";
import type { Block, TemplatePage } from "./types";

export function b(type: string, props: Record<string, unknown> = {}, sec?: Record<string, unknown>): Block {
  const created = createBlock(type);
  return {
    ...created,
    props: { ...(created.props ?? {}), ...props },
    ...(sec ? { sec: { ...(created.sec ?? {}), ...sec } } : {}),
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
  cardStyle?: NonNullable<Theme["cards"]>["style"];
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
      heading: { id: input.heading, weight: 700 },
      body: { id: input.body, weight: 400 },
      scale: "comfortable",
    },
    buttons: {
      shape: input.buttonShape ?? "soft",
      style: "solid",
      size: "normal",
      uppercase: false,
      shadow: false,
    },
    cards: { style: input.cardStyle ?? "outlined" },
    corners: input.corners ?? "soft",
    density: input.density ?? "comfortable",
    colorMode: "light",
  };
}

export function freshId(): string {
  return createId();
}
