import type { Block, ContentNode, NodeType, PageContentV5 } from "./types";

let seq = 0;

function makeId(prefix = "n"): string {
  seq += 1;
  const rand = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${seq.toString(36)}`;
}

const CONTAINER_TYPES = new Set<NodeType>([
  "page",
  "section",
  "container",
  "columns",
  "column",
  "stack",
  "grid",
]);

export function isContainerType(type: NodeType): boolean {
  return CONTAINER_TYPES.has(type);
}

export function acceptsChild(
  parentOrType: ContentNode | NodeType,
  childOrType: ContentNode | NodeType,
): boolean {
  const parentType = typeof parentOrType === "string" ? parentOrType : parentOrType.type;
  const childType = typeof childOrType === "string" ? childOrType : childOrType.type;
  if (!isContainerType(parentType)) return false;
  if (childType === "page") return false;
  if (parentType === "columns") return childType === "column";
  if (childType === "column") return false;
  return true;
}

export function defaultSmartProps(kind: string): Record<string, unknown> {
  switch (kind) {
    case "hero":
      return {
        kind: "hero",
        layout: "split",
        eyebrow: "Welcome",
        heading: "Clear headline for your business",
        subheading: "Tell visitors what you do and how to reach you.",
        buttonLabel: "Get in touch",
        buttonLink: { type: "anchor", anchor: "contact" },
      };
    case "features":
      return {
        kind: "features",
        layout: "rows",
        heading: "What we offer",
        items: [
          { title: "Fast turnaround", text: "Reliable service tailored to your schedule." },
          { title: "Local support", text: "Direct help from real people near you." },
          { title: "Clear pricing", text: "No hidden extras or surprises." },
        ],
      };
    case "cta":
      return {
        kind: "cta",
        layout: "split",
        heading: "Ready to get started?",
        subheading: "Send a message or book a quick call today.",
        buttonLabel: "Contact us",
      };
    case "faq":
      return {
        kind: "faq",
        heading: "Frequently asked questions",
        items: [
          { title: "How do I book?", text: "Send us a quick note using the form below." },
          { title: "Where are you based?", text: "We serve customers locally and nearby." },
        ],
      };
    case "contact-form":
      return {
        kind: "contact-form",
        heading: "Send us a message",
        showName: true,
        showPhone: false,
        phoneRequired: false,
      };
    case "image-text":
      return {
        kind: "image-text",
        heading: "About our work",
        text: "Share your story with a balanced photo and clear, helpful details for visitors.",
        imageId: null,
      };
    case "services":
      return {
        kind: "services",
        heading: "Services",
        items: [
          { title: "Core service", text: "Tailored help delivered on time with transparent pricing." },
          { title: "Consultation", text: "One-on-one guidance to scope what you need." },
          { title: "Ongoing support", text: "Reliable follow-through after launch." },
        ],
      };
    default:
      return { kind };
  }
}

export function defaultPropsForNode(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "heading":
      return { text: "Your heading", level: 2 };
    case "text":
      return { text: "Write a clear, helpful paragraph for your visitors." };
    case "richtext":
      return {
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Write a clear paragraph." }],
            },
          ],
        },
      };
    case "button":
      return { label: "Learn more", link: { type: "url", url: "#contact" } };
    case "image":
      return { imageId: null, alt: "Image description" };
    case "html":
      return { html: "<p>Custom content</p>" };
    case "smart":
      return defaultSmartProps("hero");
    case "reference":
      return { patternId: "" };
    case "spacer":
      return { height: 32 };
    case "columns":
      return { count: 2 };
    default:
      return {};
  }
}

export function createNode(
  type: NodeType,
  props?: Record<string, unknown>,
): ContentNode {
  const defaults = defaultPropsForNode(type);
  const merged = props ? { ...defaults, ...props } : defaults;
  const node: ContentNode = {
    id: makeId(type === "page" ? "page" : "n"),
    type,
    props: merged,
  };
  if (isContainerType(type)) {
    node.children = [];
  }
  if (type === "smart" && merged.kind === "contact-form") {
    node.requiresPlugin = "contact";
  }
  return node;
}

export function createBlock(
  type: string,
  props?: Record<string, unknown>,
): Block {
  return {
    id: makeId("blk"),
    type,
    props: props ?? (type === "smart" ? defaultSmartProps("hero") : defaultSmartProps(type)),
  };
}

export function emptyPage(): PageContentV5 {
  return {
    schemaVersion: 5,
    root: {
      id: "page",
      type: "page",
      props: {},
      children: [],
    },
  };
}

export function migrateContent(raw: unknown): {
  schemaVersion: 4;
  blocks: Block[];
} {
  if (Array.isArray(raw)) {
    const blocks = raw.map((item, idx) => {
      const rec =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};
      const type = typeof rec.type === "string" ? rec.type : "text";
      const props =
        rec.props && typeof rec.props === "object"
          ? (rec.props as Record<string, unknown>)
          : Object.fromEntries(
              Object.entries(rec).filter(
                ([k]) => !["id", "type", "sec", "sampleOnly", "includeIf"].includes(k),
              ),
            );
      return {
        id: typeof rec.id === "string" && rec.id ? rec.id : `blk_migrated_${idx + 1}`,
        type,
        props,
        ...(rec.sec && typeof rec.sec === "object"
          ? { sec: rec.sec as Block["sec"] }
          : {}),
        ...(rec.sampleOnly === true ? { sampleOnly: true } : {}),
        ...(typeof rec.includeIf === "string" ? { includeIf: rec.includeIf } : {}),
      } satisfies Block;
    });
    return { schemaVersion: 4, blocks };
  }

  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.blocks)) {
      return {
        schemaVersion: 4,
        blocks: migrateContent(rec.blocks).blocks,
      };
    }
  }

  return { schemaVersion: 4, blocks: [] };
}

export function blockToV5Node(
  rawBlock: Block | Record<string, unknown>,
  usedAnchors: Set<string>,
): ContentNode {
  const rec = rawBlock as Record<string, unknown>;
  const type = String(rec.type ?? "text");
  const props =
    rec.props && typeof rec.props === "object"
      ? { ...(rec.props as Record<string, unknown>) }
      : {};
  const id = typeof rec.id === "string" && rec.id ? rec.id : makeId("n");
  const sec =
    rec.sec && typeof rec.sec === "object"
      ? (rec.sec as Block["sec"])
      : undefined;

  let anchor = sec?.anchor?.trim();
  let attrs: ContentNode["attrs"];
  if (anchor) {
    let unique = anchor;
    let suffix = 2;
    while (usedAnchors.has(unique)) {
      unique = `${anchor}-${suffix}`;
      suffix += 1;
    }
    usedAnchors.add(unique);
    attrs = { id: unique };
  }

  if (type === "shared") {
    const patternId = String(props.sharedId ?? props.patternId ?? "");
    return {
      id,
      type: "reference",
      props: { patternId },
      ...(attrs ? { attrs } : {}),
    };
  }

  return {
    id,
    type: "smart",
    props: { ...props, kind: type },
    ...(type === "contact-form" ? { requiresPlugin: "contact" } : {}),
    ...(attrs ? { attrs } : {}),
  };
}

export function smartNodeFromBlock(
  rawBlock: Block | Record<string, unknown>,
  usedAnchors: Set<string> = new Set(),
): ContentNode {
  return blockToV5Node(rawBlock, usedAnchors);
}

export function pageFromBlocks(
  blocks: Array<Block | Record<string, unknown>>,
): PageContentV5 {
  const usedAnchors = new Set<string>();
  return {
    schemaVersion: 5,
    root: {
      id: "page",
      type: "page",
      props: {},
      children: blocks.map((b) => blockToV5Node(b, usedAnchors)),
    },
  };
}

export function migrateV4ToV5(raw: unknown): PageContentV5 {
  if (
    raw &&
    typeof raw === "object" &&
    (raw as { schemaVersion?: unknown }).schemaVersion === 5 &&
    (raw as { root?: unknown }).root
  ) {
    return raw as PageContentV5;
  }

  const version =
    raw && typeof raw === "object" && typeof (raw as { schemaVersion?: unknown }).schemaVersion === "number"
      ? ((raw as { schemaVersion: number }).schemaVersion)
      : 4;
  const migrated = migrateContent(raw);
  const page = pageFromBlocks(migrated.blocks);
  page.meta = { migratedFrom: version };
  return page;
}

export function findNode(root: ContentNode, id: string): ContentNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

export function findParent(
  root: ContentNode,
  id: string,
): { parent: ContentNode; index: number } | null {
  const children = root.children ?? [];
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]!;
    if (child.id === id) return { parent: root, index: i };
    const deeper = findParent(child, id);
    if (deeper) return deeper;
  }
  return null;
}

export function cloneNode(node: ContentNode): ContentNode {
  return {
    ...structuredClone(node),
    id: makeId(node.type === "page" ? "page" : "n"),
    ...(node.children
      ? { children: node.children.map((child) => cloneNode(child)) }
      : {}),
  };
}

export function countNodes(root: ContentNode): number {
  return 1 + (root.children ?? []).reduce((sum, c) => sum + countNodes(c), 0);
}

export function replaceNode(
  root: ContentNode,
  id: string,
  updaterOrNode: ContentNode | ((node: ContentNode) => ContentNode),
): ContentNode {
  if (root.id === id) {
    return typeof updaterOrNode === "function" ? updaterOrNode(root) : updaterOrNode;
  }
  if (!root.children) return root;
  let changed = false;
  const nextChildren = root.children.map((child) => {
    const updated = replaceNode(child, id, updaterOrNode);
    if (updated !== child) changed = true;
    return updated;
  });
  return changed ? { ...root, children: nextChildren } : root;
}

export function insertNode(
  root: ContentNode,
  parentId: string,
  node: ContentNode,
  index?: number,
): ContentNode {
  return replaceNode(root, parentId, (parent) => {
    const current = parent.children ?? [];
    const pos =
      typeof index === "number"
        ? Math.max(0, Math.min(current.length, index))
        : current.length;
    const next = [...current];
    next.splice(pos, 0, node);
    return { ...parent, children: next };
  });
}

export function removeNode(root: ContentNode, id: string): ContentNode {
  if (root.id === id) return root;
  if (!root.children) return root;
  const filtered = root.children
    .filter((child) => child.id !== id)
    .map((child) => removeNode(child, id));
  return { ...root, children: filtered };
}

export function moveNode(
  root: ContentNode,
  nodeId: string,
  targetParentId: string,
  targetIndex?: number,
): ContentNode {
  if (nodeId === root.id || nodeId === targetParentId) return root;
  const existing = findNode(root, nodeId);
  if (!existing) return root;
  if (findNode(existing, targetParentId)) return root;
  const without = removeNode(root, nodeId);
  return insertNode(without, targetParentId, existing, targetIndex);
}

export function duplicateNode(root: ContentNode, id: string): ContentNode {
  if (id === root.id) return root;
  const parentInfo = findParent(root, id);
  if (!parentInfo) return root;
  const original = parentInfo.parent.children?.[parentInfo.index];
  if (!original) return root;
  return insertNode(
    root,
    parentInfo.parent.id,
    cloneNode(original),
    parentInfo.index + 1,
  );
}

export function generateStarterContent(input: {
  businessName: string;
  businessType?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  includeContactForm?: boolean;
}): { schemaVersion: 3; blocks: Block[] } {
  const kind = (input.businessType ?? "").toLowerCase();
  const kindLabel = input.businessType ? ` ${input.businessType}` : "";
  const sub =
    input.description ||
    `A warm, dependable${kindLabel} website ready for your customers.`;

  let blocks: Block[];
  if (/restaurant|cafe|bakery|bistro|food/.test(kind)) {
    blocks = [
      createBlock("hero", {
        layout: "fullbleed",
        eyebrow: input.businessName,
        heading: input.businessName,
        subheading: sub,
        buttonLabel: "View the menu",
        buttonLink: { type: "anchor", anchor: "menu" },
      }),
      createBlock("menu", {
        layout: "menu-list",
        heading: "Fresh from the kitchen",
        items: [
          { title: "House specialty", price: "$14", text: "Prepared daily with seasonal local produce." },
          { title: "Chef selection", price: "$18", text: "Slow-cooked favourite paired with warm sides." },
          { title: "Sweet finish", price: "$9", text: "Small-batch pastry and freshly brewed coffee." },
        ],
      }),
      createBlock("cta", {
        layout: "centered",
        heading: `Visit ${input.businessName}`,
        subheading: input.address || "Drop in this week or message us for group bookings.",
        buttonLabel: "Book a table",
        buttonLink: { type: "anchor", anchor: "contact" },
      }),
    ];
  } else if (/software|saas|tech|app/.test(kind)) {
    blocks = [
      createBlock("hero", {
        layout: "product-shot",
        eyebrow: "Built for teams",
        heading: input.businessName,
        subheading: sub,
        buttonLabel: "See plans",
        buttonLink: { type: "anchor", anchor: "contact" },
      }),
      createBlock("stats", {
        layout: "compact",
        heading: "Proven at scale",
        items: [
          { value: "99.9%", title: "Uptime", text: "Measured across regional edge nodes." },
          { value: "2 min", title: "Setup", text: "Go from sign-up to live workspace quickly." },
          { value: "24/7", title: "Monitoring", text: "Automated checks around the clock." },
        ],
      }),
      createBlock("features", {
        layout: "bento",
        heading: "Everything your team needs",
        items: [
          { title: "Automated workflows", text: "Cut repetitive manual steps in minutes." },
          { title: "Role controls", text: "Keep sensitive workspaces scoped cleanly." },
          { title: "Clear reporting", text: "See progress without complex dashboards." },
        ],
      }),
    ];
  } else if (/law|legal|account|consult/.test(kind)) {
    blocks = [
      createBlock("hero", {
        layout: "arch",
        eyebrow: input.businessType || "Advisory",
        heading: input.businessName,
        subheading: sub,
        buttonLabel: "Request a consultation",
        buttonLink: { type: "anchor", anchor: "contact" },
      }),
      createBlock("features", {
        layout: "alternating",
        heading: "Practice areas",
        items: [
          { title: "Clear counsel", text: "Practical guidance explained in plain language." },
          { title: "Thorough review", text: "Careful documentation before every commitment." },
        ],
      }),
      createBlock("faq", {
        heading: "Client questions",
        items: [
          { title: "How do initial consultations work?", text: "Share a brief outline and we schedule a confidential call." },
          { title: "Are fees explained upfront?", text: "Yes. Every scope starts with a written fee outline." },
        ],
      }),
    ];
  } else if (/plumb|repair|home|trade|clean|construct/.test(kind)) {
    blocks = [
      createBlock("hero", {
        layout: "diagonal",
        eyebrow: "Dependable local crew",
        heading: input.businessName,
        subheading: sub,
        buttonLabel: "Request a quote",
        buttonLink: { type: "anchor", anchor: "contact" },
      }),
      createBlock("features", {
        layout: "rows",
        heading: "Services",
        items: [
          { title: "Same-week callouts", text: "Fast scheduling with clear arrival windows." },
          { title: "Upfront quotes", text: "Written estimates before work starts." },
          { title: "Workmanship guarantee", text: "Every job checked and tested on site." },
        ],
      }),
      createBlock("testimonials", {
        layout: "grid",
        heading: "What neighbours say",
        items: [
          { quote: "Arrived on time, explained the fix clearly, and left everything spotless.", author: "Local homeowner" },
          { quote: "Fair price and sorted the issue in a single visit.", author: "Repeat customer" },
        ],
      }),
    ];
  } else {
    blocks = [
      createBlock("hero", {
        layout: "split",
        eyebrow: input.businessName,
        heading: `Welcome to ${input.businessName}`,
        subheading: sub,
        buttonLabel: "Get in touch",
        buttonLink: { type: "anchor", anchor: "contact" },
      }),
      createBlock("features", {
        layout: "bento",
        heading: "What we do",
        items: [
          { title: "Quality service", text: "Built around what local customers actually need." },
          { title: "Fast response", text: "Clear answers and easy booking." },
          { title: "Clear pricing", text: "Straightforward quotes with zero surprises." },
        ],
      }),
      createBlock("cta", {
        layout: "split",
        heading: `Work with ${input.businessName}`,
        buttonLabel: "Contact us",
        buttonLink: { type: "anchor", anchor: "contact" },
      }),
    ];
  }

  if (input.includeContactForm) {
    blocks.push(
      createBlock("contact-form", {
        heading: "Send us a message",
        showName: true,
        showPhone: Boolean(input.phone),
        phoneRequired: false,
      }),
    );
  }
  return {
    schemaVersion: 3,
    blocks,
  };
}

export function isPageContentV5(raw: unknown): raw is PageContentV5 {
  return Boolean(
    raw &&
      typeof raw === "object" &&
      (raw as { schemaVersion?: unknown }).schemaVersion === 5 &&
      (raw as { root?: unknown }).root &&
      typeof (raw as { root?: unknown }).root === "object",
  );
}

export type CollectedBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  requiresPlugin?: string;
  sampleOnly?: boolean;
};

export function collectContentBlocks(raw: unknown): CollectedBlock[] {
  if (Array.isArray(raw)) {
    const out: CollectedBlock[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const type = typeof rec.type === "string" ? rec.type : "";
      if (!type) continue;
      out.push({
        id: typeof rec.id === "string" ? rec.id : "",
        type,
        props:
          rec.props && typeof rec.props === "object"
            ? (rec.props as Record<string, unknown>)
            : {},
        sampleOnly: rec.sampleOnly === true,
      });
    }
    return out;
  }
  if (isPageContentV5(raw)) {
    const out: CollectedBlock[] = [];
    const walk = (node: ContentNode): void => {
      const props = node.props ?? {};
      if (node.type === "smart") {
        const kind = typeof props.kind === "string" ? props.kind : "text";
        out.push({
          id: node.id,
          type: kind,
          props,
          requiresPlugin: node.requiresPlugin,
        });
      } else if (node.type !== "page") {
        out.push({
          id: node.id,
          type: node.type,
          props,
          requiresPlugin: node.requiresPlugin,
        });
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(raw.root);
    return out;
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as { blocks?: unknown[] }).blocks)) {
    return collectContentBlocks((raw as { blocks: unknown[] }).blocks);
  }
  return [];
}

export function countSampleBlocks(blocks: unknown): number {
  return collectContentBlocks(blocks).filter((item) => item.sampleOnly === true).length;
}

const BLOCK_LABELS: Record<string, string> = {
  hero: "Hero banner",
  heading: "Heading",
  text: "Text section",
  features: "Features",
  gallery: "Gallery",
  testimonials: "Testimonials",
  pricing: "Pricing",
  faq: "FAQ",
  cta: "Call to action",
  team: "Team",
  "contact-form": "Contact form",
  "before-after": "Before & after",
  stats: "Stats",
  menu: "Menu",
  schedule: "Schedule",
  "image-text": "Image & text",
  services: "Services",
  shared: "Shared pattern",
};

export function blockLabel(type: string): string {
  return BLOCK_LABELS[type] ?? type;
}

export function blockSummary(block: unknown): string {
  const props =
    block && typeof block === "object" && "props" in block && block.props && typeof block.props === "object"
      ? (block.props as Record<string, unknown>)
      : {};
  const text =
    (typeof props.heading === "string" && props.heading) ||
    (typeof props.title === "string" && props.title) ||
    (typeof props.text === "string" && props.text) ||
    (typeof props.subheading === "string" && props.subheading) ||
    "";
  return text.trim().slice(0, 80);
}
