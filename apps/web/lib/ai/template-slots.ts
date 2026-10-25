import { blockWithIdSchema, migrateContent } from "@get-on/blocks";

export type PageRow = { id: string; blocks: unknown };
export type SlotRef = {
  id: string;
  pageId: string;
  blockId: string;
  path: Array<string | number>;
  maxLength: number;
};
export type TemplateSlot = { id: string; text: string };
export type TemplateFillPlan = {
  slots: TemplateSlot[];
  refs: Map<string, SlotRef>;
};

const SKIP_KEYS = new Set([
  "type",
  "id",
  "sharedId",
  "imageId",
  "photoId",
  "posterId",
  "beforeId",
  "afterId",
  "fileId",
  "pageId",
  "url",
  "href",
  "link",
  "buttonLink",
  "button2Link",
  "secondaryLink",
  "primaryLink",
  "icon",
  "network",
  "platform",
  "layout",
  "columns",
  "align",
  "background",
  "size",
  "ratio",
  "style",
  "level",
  "variation",
  "source",
  "from",
  "to",
  "period",
  "color",
  "color2",
  "themeColor",
  "imagePosition",
  "imageStyle",
  "photoStyle",
  "orderMode",
  "phone",
  "email",
  "address",
  "whatsapp",
  "tags",
  "social",
  "socialLinks",
  "customHours",
  "hours",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
  "value",
  "result",
  "badge",
  "price",
  "oldPrice",
  "rating",
  "openFirst",
  "leaders",
  "zoom",
  "rounded",
  "grayscale",
  "showCaptions",
  "showHours",
  "showMapLink",
  "showSocial",
  "showName",
  "showPhone",
  "phoneRequired",
  "compactDays",
  "hidden",
  "hideOn",
  "anchor",
]);

const MAX_BY_KEY: Record<string, number> = {
  eyebrow: 40,
  heading: 120,
  subheading: 300,
  text: 300,
  title: 80,
  name: 80,
  description: 200,
  intro: 300,
  question: 150,
  answer: 600,
  quote: 400,
  role: 60,
  bio: 160,
  caption: 100,
  label: 60,
  primaryLabel: 30,
  secondaryLabel: 30,
  buttonLabel: 30,
  button2Label: 30,
  submitLabel: 30,
  consentText: 160,
  note: 160,
  hoursNote: 300,
  linkLabel: 24,
  orderLabel: 24,
  fileLabel: 40,
  category: 30,
};

const MAX_SLOTS = 80;
const MAX_TOTAL_CHARS = 16000;

function maxFor(key: string): number {
  return MAX_BY_KEY[key] ?? 300;
}

function isText(value: string, includeEmpty: boolean): boolean {
  const trimmed = value.trim();
  if (!trimmed) return includeEmpty;
  if (trimmed.length > 1200) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (trimmed.startsWith("{{")) return false;
  return true;
}

function walk(
  value: unknown,
  path: Array<string | number>,
  key: string,
  pageId: string,
  blockId: string,
  plan: TemplateFillPlan,
  total: { chars: number },
  includeEmpty: boolean,
): void {
  if (SKIP_KEYS.has(key)) return;
  if (typeof value === "string") {
    if (plan.slots.length >= MAX_SLOTS) return;
    if (!isText(value, includeEmpty)) return;
    const text = value.trim();
    if (total.chars + text.length > MAX_TOTAL_CHARS) return;
    const id = `${blockId}:${path.join(".")}`;
    if (plan.refs.has(id)) return;
    plan.slots.push({ id, text });
    plan.refs.set(id, {
      id,
      pageId,
      blockId,
      path,
      maxLength: maxFor(key),
    });
    total.chars += text.length;
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(item, [...path, index], key, pageId, blockId, plan, total, includeEmpty),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) {
      walk(child, [...path, childKey], childKey, pageId, blockId, plan, total, includeEmpty);
    }
  }
}

export function collectTemplateSlots(
  pages: PageRow[],
  options: { includeEmpty?: boolean } = {},
): TemplateFillPlan {
  const plan: TemplateFillPlan = { slots: [], refs: new Map() };
  const total = { chars: 0 };
  for (const page of pages) {
    const content = migrateContent(page.blocks);
    for (const block of content.blocks) {
      const id =
        block && typeof block === "object" && typeof (block as { id?: unknown }).id === "string"
          ? (block as { id: string }).id
          : null;
      if (!id) continue;
      const props =
        block && typeof block === "object"
          ? (block as { props?: unknown }).props
          : null;
      walk(props, ["props"], "props", page.id, id, plan, total, options.includeEmpty === true);
    }
  }
  return plan;
}

function setAtPath(
  root: Record<string, unknown>,
  path: Array<string | number>,
  value: string,
): void {
  let current: unknown = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    if (!current || typeof current !== "object") return;
    current = (current as Record<string | number, unknown>)[path[index]!];
  }
  if (!current || typeof current !== "object") return;
  (current as Record<string | number, unknown>)[path[path.length - 1]!] = value;
}

export function applyTemplateSlots(
  pages: PageRow[],
  plan: TemplateFillPlan,
  replacements: Map<string, string>,
): { pages: Array<{ id: string; blocks: unknown[]; changed: number }>; changed: number } {
  const byPage = new Map<string, Array<{ ref: SlotRef; text: string }>>();
  for (const [id, text] of replacements) {
    const ref = plan.refs.get(id);
    if (!ref) continue;
    const list = byPage.get(ref.pageId) ?? [];
    list.push({ ref, text });
    byPage.set(ref.pageId, list);
  }

  let changed = 0;
  const updated = pages.map((page) => {
    const content = migrateContent(page.blocks);
    const items = byPage.get(page.id) ?? [];
    if (items.length === 0) {
      return { id: page.id, blocks: content.blocks, changed: 0 };
    }
    let pageChanged = 0;
    const blocks = content.blocks.map((block) => {
      const blockId =
        block && typeof block === "object" && typeof (block as { id?: unknown }).id === "string"
          ? (block as { id: string }).id
          : null;
      const blockItems = blockId ? items.filter((item) => item.ref.blockId === blockId) : [];
      if (!blockId || blockItems.length === 0) return block;
      const clone = JSON.parse(JSON.stringify(block)) as Record<string, unknown>;
      for (const item of blockItems) {
        const value = item.text.trim().slice(0, item.ref.maxLength);
        if (value) setAtPath(clone, item.ref.path, value);
      }
      const parsed = blockWithIdSchema.safeParse(clone);
      if (!parsed.success) return block;
      pageChanged += blockItems.length;
      return parsed.data;
    });
    changed += pageChanged;
    return { id: page.id, blocks, changed: pageChanged };
  });

  return { pages: updated, changed };
}

