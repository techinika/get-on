import { z } from "zod";
import { resolveThemeColors } from "./theme";
import type {
  Block,
  ContentNode,
  Declarations,
  PageContentV5,
  RichNode,
  StyleSet,
  Theme,
} from "./types";

export function customCodeLimits(planId?: string) {
  const maxPatterns =
    planId === "enterprise" ? 100 : planId === "pro" ? 50 : planId === "basic" ? 15 : 5;
  return {
    maxCssBytes: 16 * 1024,
    maxHtmlBytes: 24 * 1024,
    maxNodes: 250,
    patterns: maxPatterns,
  } as const;
}

customCodeLimits.maxCssBytes = 16 * 1024;
customCodeLimits.maxHtmlBytes = 24 * 1024;
customCodeLimits.maxNodes = 250;

export const ALLOWED_STYLE_PROPS = new Set([
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "width",
  "min-width",
  "max-width",
  "height",
  "min-height",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "color",
  "background-color",
  "border",
  "border-color",
  "border-width",
  "border-style",
  "border-radius",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "opacity",
  "box-shadow",
  "object-fit",
  "overflow",
]);

export const STYLE_SELECT_OPTIONS: Record<string, string[]> = {
  display: ["block", "flex", "grid", "inline-flex", "none"],
  position: ["static", "relative", "sticky"],
  "flex-direction": ["row", "column", "row-reverse", "column-reverse"],
  "justify-content": ["flex-start", "center", "flex-end", "space-between", "space-around"],
  "align-items": ["stretch", "flex-start", "center", "flex-end", "baseline"],
  "text-align": ["left", "center", "right", "justify"],
  "font-weight": ["400", "500", "600", "700", "800"],
  "text-transform": ["none", "uppercase", "lowercase", "capitalize"],
  "border-style": ["none", "solid", "dashed", "dotted"],
  "object-fit": ["cover", "contain", "fill", "none"],
  overflow: ["visible", "hidden", "auto", "scroll"],
};

export type StyleControlDef = {
  prop: string;
  label: string;
  control: "select" | "text" | "color" | "colour" | "spacing" | "length";
  placeholder?: string;
};

export type StyleGroupDef = {
  id: string;
  label: string;
  props: StyleControlDef[];
};

export const STYLE_GROUPS: StyleGroupDef[] = [
  {
    id: "layout",
    label: "Layout",
    props: [
      { prop: "display", label: "Display", control: "select" },
      { prop: "flex-direction", label: "Direction", control: "select" },
      { prop: "justify-content", label: "Justify", control: "select" },
      { prop: "align-items", label: "Align", control: "select" },
      { prop: "gap", label: "Gap", control: "spacing", placeholder: "16px" },
      { prop: "position", label: "Position", control: "select" },
    ],
  },
  {
    id: "size",
    label: "Size & Spacing",
    props: [
      { prop: "width", label: "Width", control: "text", placeholder: "auto" },
      { prop: "max-width", label: "Max width", control: "text", placeholder: "100%" },
      { prop: "padding", label: "Padding", control: "spacing", placeholder: "16px" },
      { prop: "margin", label: "Margin", control: "spacing", placeholder: "0" },
    ],
  },
  {
    id: "typography",
    label: "Typography",
    props: [
      { prop: "font-size", label: "Font size", control: "text", placeholder: "16px" },
      { prop: "font-weight", label: "Weight", control: "select" },
      { prop: "line-height", label: "Line height", control: "text", placeholder: "1.5" },
      { prop: "text-align", label: "Align", control: "select" },
      { prop: "text-transform", label: "Transform", control: "select" },
      { prop: "color", label: "Text color", control: "color" },
    ],
  },
  {
    id: "surface",
    label: "Surface & Media",
    props: [
      { prop: "background-color", label: "Background", control: "color" },
      { prop: "border-radius", label: "Radius", control: "spacing", placeholder: "8px" },
      { prop: "border-style", label: "Border style", control: "select" },
      { prop: "border-width", label: "Border width", control: "spacing", placeholder: "1px" },
      { prop: "border-color", label: "Border color", control: "color" },
      { prop: "object-fit", label: "Image fit", control: "select" },
      { prop: "overflow", label: "Overflow", control: "select" },
    ],
  },
];

export function validateStyleValue(
  prop: string,
  value: string,
): { ok: true } | { ok: false; error: string } {
  const cleanProp = prop.trim().toLowerCase();
  if (!ALLOWED_STYLE_PROPS.has(cleanProp)) {
    return { ok: false, error: `Style property "${prop}" is not allowed.` };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "Style value cannot be empty." };
  if (/!important|javascript:|expression\s*\(|@import|url\s*\(\s*['"]?https?:/i.test(trimmed)) {
    return { ok: false, error: "Disallowed value in style." };
  }
  const selectChoices = STYLE_SELECT_OPTIONS[cleanProp];
  if (selectChoices && !selectChoices.includes(trimmed)) {
    return { ok: false, error: `Invalid option "${trimmed}" for ${cleanProp}.` };
  }
  return { ok: true };
}

function tokenToCssVar(value: string): string {
  return value.replace(/\{(primary|accent|bg|text|soft|on-primary|muted|border)\}/g, (_, tok) => {
    return `var(--s-${tok})`;
  });
}

function fnv1aHex(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function formatDecls(decls: Declarations): string {
  return Object.entries(decls)
    .filter(([prop, val]) => ALLOWED_STYLE_PROPS.has(prop.toLowerCase()) && val.trim() !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prop, val]) => `${prop.toLowerCase()}:${tokenToCssVar(val.trim())}`)
    .join(";");
}

const FORBIDDEN_CUSTOM_CSS_SELECTORS = [
  ".gs-watermark",
  "[data-gs-protect]",
  ".gs-protect",
];

function cleanSelectorList(rawSelector: string): { ok: true; selector: string } | { ok: false; error: string } {
  const parts = rawSelector.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Empty selector." };
  const mapped: string[] = [];
  for (const part of parts) {
    if (part === "*" || /(^|[\s>+~])\*/.test(part)) {
      return { ok: false, error: "Universal (*) selectors are not allowed." };
    }
    for (const forbidden of FORBIDDEN_CUSTOM_CSS_SELECTORS) {
      if (part.includes(forbidden)) {
        return { ok: false, error: `Selector "${forbidden}" is protected.` };
      }
    }
    if (part === ":root" || part === "html" || part === "body") {
      mapped.push(".gs-root");
    } else if (part.startsWith(".gs-root")) {
      mapped.push(part);
    } else {
      mapped.push(`.gs-root ${part}`);
    }
  }
  return { ok: true, selector: mapped.join(",") };
}

function sanitizeRuleDeclarations(rawBody: string, errors: string[]): string[] {
  const decls: string[] = [];
  for (const part of rawBody.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      errors.push(`Invalid CSS declaration "${trimmed.slice(0, 48)}" (missing ":").`);
      continue;
    }
    const prop = trimmed.slice(0, colon).trim().toLowerCase();
    let val = trimmed.slice(colon + 1).trim();
    if (!prop || !val) {
      errors.push(`Incomplete CSS declaration "${trimmed.slice(0, 48)}".`);
      continue;
    }
    if (!/^[a-z-]+$/.test(prop)) {
      errors.push(`Unsupported CSS property "${prop}".`);
      continue;
    }
    if (/!important/i.test(val)) {
      errors.push(`!important is not allowed on "${prop}".`);
      continue;
    }
    if (/expression\s*\(|javascript:/i.test(val)) {
      errors.push(`Unsafe CSS value on "${prop}".`);
      continue;
    }
    const externalUrl = /url\s*\(\s*['"]?\s*((?:https?:)?\/\/[^)'"]+)['"]?\s*\)/i.exec(val);
    if (externalUrl?.[1]) {
      errors.push(`External URL not allowed: ${externalUrl[1]}`);
      continue;
    }
    if (prop === "position" && val.toLowerCase() === "fixed") {
      val = "sticky";
    }
    decls.push(`${prop}:${val}`);
  }
  return decls;
}

type ParsedCssBlock = { header: string; body: string };

function splitTopLevelCssBlocks(css: string): { blocks: ParsedCssBlock[]; unbalanced: boolean } {
  const blocks: ParsedCssBlock[] = [];
  let i = 0;
  let start = 0;
  while (i < css.length) {
    const openIdx = css.indexOf("{", i);
    if (openIdx === -1) {
      const trailing = css.slice(start).trim();
      if (trailing.includes("}")) return { blocks, unbalanced: true };
      break;
    }
    const header = css.slice(start, openIdx).trim();
    let depth = 1;
    let j = openIdx + 1;
    let inSingle = false;
    let inDouble = false;
    while (j < css.length && depth > 0) {
      const ch = css[j]!;
      const prev = j > 0 ? css[j - 1] : "";
      if (ch === "'" && !inDouble && prev !== "\\") inSingle = !inSingle;
      else if (ch === '"' && !inSingle && prev !== "\\") inDouble = !inDouble;
      else if (!inSingle && !inDouble) {
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
      }
      j += 1;
    }
    if (depth !== 0) {
      return { blocks, unbalanced: true };
    }
    const body = css.slice(openIdx + 1, j - 1).trim();
    blocks.push({ header, body });
    start = j;
    i = j;
  }
  return { blocks, unbalanced: false };
}

function sanitizeSafeBlocks(
  rawCss: string,
  errors: string[],
  allowAtMedia: boolean,
): string[] {
  const { blocks, unbalanced } = splitTopLevelCssBlocks(rawCss);
  if (unbalanced) {
    errors.push("Unbalanced curly braces { } in custom CSS.");
  }
  const out: string[] = [];
  for (const block of blocks) {
    const rawHeader = block.header.trim();
    if (!rawHeader) {
      errors.push("CSS rule is missing a selector.");
      continue;
    }
    if (rawHeader.startsWith("@")) {
      if (allowAtMedia && /^@media\b/i.test(rawHeader)) {
        const inner = sanitizeSafeBlocks(block.body, errors, false);
        if (inner.length > 0) {
          out.push(`${rawHeader}{${inner.join("")}}`);
        }
      } else {
        errors.push(`At-rule "${rawHeader.split(/\s+/)[0]}" is not supported.`);
      }
      continue;
    }
    const selRes = cleanSelectorList(rawHeader);
    if (!selRes.ok) {
      errors.push(selRes.error);
      continue;
    }
    const decls = sanitizeRuleDeclarations(block.body, errors);
    if (decls.length > 0) {
      out.push(`${selRes.selector}{${decls.join(";")}}`);
    }
  }
  return out;
}

export function sanitizeCustomCss(rawCss: string): {
  ok: boolean;
  css: string;
  errors: string[];
} {
  const errors: string[] = [];
  if (!rawCss || !rawCss.trim()) return { ok: true, css: "", errors: [] };
  if (new TextEncoder().encode(rawCss).byteLength > customCodeLimits.maxCssBytes) {
    return { ok: false, css: "", errors: ["Custom CSS exceeds size limit."] };
  }

  const stripped = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/@import\b/i.test(stripped)) errors.push("@import is not allowed in custom CSS.");
  if (/@font-face\b/i.test(stripped)) errors.push("@font-face is not allowed in custom CSS.");

  const safeRules = sanitizeSafeBlocks(stripped, errors, true);
  const compiledCss = safeRules.join("");

  return {
    ok: errors.length === 0,
    css: compiledCss,
    errors,
  };
}

export function compileStyles(
  root: ContentNode,
  opts?: { customCss?: string },
): { css: string; classes: Map<string, string[]> } {
  const classes = new Map<string, string[]>();
  const baseRules = new Map<string, string>();
  const stateRules: string[] = [];
  const tabletRules: string[] = [];
  const phoneRules: string[] = [];

  function walk(node: ContentNode) {
    const nodeClasses: string[] = [];
    const styles: StyleSet | undefined = node.styles;

    if (styles?.base) {
      const body = formatDecls(styles.base);
      if (body) {
        const cls = `gs-s-${fnv1aHex(`base:${body}`)}`;
        nodeClasses.push(cls);
        if (!baseRules.has(cls)) {
          baseRules.set(cls, `.${cls}{${body}}`);
        }
      }
    }

    for (const state of ["hover", "focus", "active"] as const) {
      const decls = styles?.[state];
      if (decls) {
        const body = formatDecls(decls);
        if (body) {
          const cls = `gs-s-${fnv1aHex(`${state}:${body}`)}`;
          nodeClasses.push(cls);
          stateRules.push(`.${cls}:${state}{${body}}`);
        }
      }
    }

    if (styles?.tablet) {
      const body = formatDecls(styles.tablet);
      if (body) {
        const cls = `gs-s-${fnv1aHex(`tablet:${body}`)}`;
        nodeClasses.push(cls);
        tabletRules.push(`.${cls}{${body}}`);
      }
    }

    if (styles?.phone) {
      const body = formatDecls(styles.phone);
      if (body) {
        const cls = `gs-s-${fnv1aHex(`phone:${body}`)}`;
        nodeClasses.push(cls);
        phoneRules.push(`.${cls}{${body}}`);
      }
    }

    if (nodeClasses.length > 0) {
      classes.set(node.id, nodeClasses);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(root);

  const chunks: string[] = [
    "@layer gs-protect, gs-base, gs-theme, gs-nodes, gs-user;",
  ];

  const nodeCssParts = [...baseRules.values(), ...stateRules];
  if (tabletRules.length > 0) {
    nodeCssParts.push(`@container site (max-width:899px){${tabletRules.join("")}}`);
  }
  if (phoneRules.length > 0) {
    nodeCssParts.push(`@container site (max-width:639px){${phoneRules.join("")}}`);
  }
  if (nodeCssParts.length > 0) {
    chunks.push(`@layer gs-nodes{${nodeCssParts.join("")}}`);
  }

  if (opts?.customCss) {
    const clean = sanitizeCustomCss(opts.customCss);
    if (clean.css) {
      chunks.push(`@layer gs-user{${clean.css}}`);
    }
  }

  return { css: chunks.join(""), classes };
}

const DANGEROUS_TAG_RE = /<(script|iframe|object|embed|style|link|meta|base|form)\b[^>]*>[\s\S]*?<\/\1>|<(script|iframe|object|embed|style|link|meta|base)\b[^>]*\/?>/gi;

export function sanitizeHtml(rawHtml: string): {
  ok: boolean;
  html: string;
  errors: string[];
} {
  const errors: string[] = [];
  if (!rawHtml) return { ok: true, html: "", errors: [] };

  let working = rawHtml;
  if (DANGEROUS_TAG_RE.test(working)) {
    errors.push("Unsafe HTML tags were removed.");
    working = working.replace(DANGEROUS_TAG_RE, "");
  }
  if (/\son[a-z]+\s*=/i.test(working)) {
    errors.push("Inline event handlers are not allowed.");
    working = working.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  }
  if (/javascript:|data:\s*text\/html/i.test(working)) {
    errors.push("Unsafe URL scheme in HTML.");
    working = working.replace(/(href|src)\s*=\s*(['"])\s*(?:javascript:|data:\s*text\/html)[^'"]*\2/gi, '$1=$2#$2');
  }

  return {
    ok: errors.length === 0,
    html: working,
    errors,
  };
}

export function richTextFromPlain(text: string): RichNode {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    type: "doc",
    content: (paragraphs.length ? paragraphs : [""]).map((p) => ({
      type: "paragraph",
      content: p ? [{ type: "text", text: p }] : [],
    })),
  };
}

export function richTextToPlain(node: string | RichNode | null | undefined): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content
    .map((child) => richTextToPlain(child as RichNode))
    .join(node.type === "doc" ? "\n\n" : "");
}

export function sanitizeRichText(doc: RichNode | Record<string, unknown>): {
  ok: boolean;
  doc: RichNode;
  text: string;
  errors: string[];
} {
  const errors: string[] = [];

  function walk(node: RichNode): RichNode {
    const next: RichNode = { ...node };
    if (Array.isArray(node.marks)) {
      next.marks = node.marks.filter((mark) => {
        if (mark.type === "link") {
          const href = String(mark.attrs?.href ?? "").trim();
          if (href && !/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
            errors.push(`Unsafe link href: ${href}`);
            return false;
          }
        }
        return true;
      });
    }
    if (Array.isArray(node.content)) {
      next.content = node.content.map((child) => walk(child as RichNode));
    }
    return next;
  }

  const cleaned = walk(doc as RichNode);
  return { ok: errors.length === 0, doc: cleaned, text: richTextToPlain(cleaned), errors };
}

export const KNOWN_SMART_KINDS = new Set([
  "hero",
  "heading",
  "text",
  "image-text",
  "features",
  "services",
  "gallery",
  "testimonials",
  "pricing",
  "faq",
  "cta",
  "team",
  "contact-form",
  "before-after",
  "stats",
  "menu",
  "schedule",
  "shared",
  "custom-code",
  "embed",
  "video",
  "map",
  "list",
  "quote",
  "banner",
  "newsletter",
  "plugin",
]);

const PROTECTED_CLASSES = new Set(["gs-watermark", "gs-protect", "gs-root"]);

export type ValidationError = {
  code: string;
  nodeId?: string;
  message: string;
};

export function validateContentV5(
  page: PageContentV5,
  opts?: { enabledPlugins?: string[] },
): { ok: true; content: PageContentV5 } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!page || page.schemaVersion !== 5 || !page.root) {
    return { ok: false, errors: [{ code: "schema.invalid", message: "Invalid page content." }] };
  }

  const seenIds = new Set<string>();
  const leafTypes = new Set([
    "heading",
    "text",
    "richtext",
    "image",
    "button",
    "divider",
    "spacer",
    "html",
    "smart",
    "reference",
  ]);
  let totalNodes = 0;

  function visit(node: ContentNode, parentType: ContentNode["type"] | null) {
    totalNodes += 1;
    if (seenIds.has(node.id)) {
      errors.push({ code: "id.duplicate", nodeId: node.id, message: `Duplicate node id: ${node.id}` });
    }
    seenIds.add(node.id);

    if (leafTypes.has(node.type) && Array.isArray(node.children) && node.children.length > 0) {
      errors.push({ code: "tree.leaf_children", nodeId: node.id, message: `${node.type} cannot have children.` });
    }
    if (node.type === "column" && parentType !== "columns") {
      errors.push({ code: "tree.orphan_column", nodeId: node.id, message: "Column must be inside Columns." });
    }
    if (node.type === "smart") {
      const kind = String(node.props?.kind ?? "");
      if (!KNOWN_SMART_KINDS.has(kind)) {
        errors.push({ code: "smart.unknown", nodeId: node.id, message: `Unknown smart kind: ${kind}` });
      }
    }
    if (opts?.enabledPlugins && node.requiresPlugin && !opts.enabledPlugins.includes(node.requiresPlugin)) {
      errors.push({
        code: "plugin.missing",
        nodeId: node.id,
        message: `Plugin "${node.requiresPlugin}" is not active.`,
      });
    }
    if (node.type === "html") {
      const res = sanitizeHtml(String(node.props?.html ?? ""));
      if (!res.ok) {
        errors.push({ code: "html", nodeId: node.id, message: res.errors.join(" ") });
      }
    }
    if (node.type === "richtext" && node.props?.doc) {
      const res = sanitizeRichText(node.props.doc as RichNode);
      if (!res.ok) {
        errors.push({ code: "richtext", nodeId: node.id, message: res.errors.join(" ") });
      }
    }
    if (node.styles) {
      for (const decls of Object.values(node.styles)) {
        if (!decls) continue;
        for (const [prop, val] of Object.entries(decls)) {
          const checked = validateStyleValue(prop, val);
          if (!checked.ok) {
            errors.push({ code: "style.invalid", nodeId: node.id, message: checked.error });
          }
        }
      }
    }
    if (Array.isArray(node.classes)) {
      for (const cls of node.classes) {
        if (PROTECTED_CLASSES.has(cls)) {
          errors.push({ code: "class.protected", nodeId: node.id, message: `Class "${cls}" is protected.` });
        }
      }
    }
    for (const child of node.children ?? []) {
      visit(child, node.type);
    }
  }

  visit(page.root, null);
  if (totalNodes > customCodeLimits.maxNodes) {
    errors.push({ code: "tree.too_large", message: "Page has too many nodes." });
  }

  return errors.length === 0 ? { ok: true, content: page } : { ok: false, errors };
}

export type PageDiagnostic = {
  id: string;
  source: "css" | "node" | "layout";
  severity: "error" | "warning";
  nodeId?: string;
  prop?: string;
  styleKey?: string;
  message: string;
  hint?: string;
};

/**
 * Validates only hard structural invariants (schemaVersion, root container, node cap)
 * so drafts with work-in-progress CSS or style mistakes always save cleanly while
 * unsafe rules are neutralized on render/publish and surfaced in the Errors panel.
 */
export function preparePageContentForSave(
  page: PageContentV5,
): { ok: true; content: PageContentV5 } | { ok: false; errors: ValidationError[] } {
  if (!page || page.schemaVersion !== 5 || !page.root || typeof page.root !== "object") {
    return { ok: false, errors: [{ code: "schema.invalid", message: "Invalid page content." }] };
  }
  let totalNodes = 0;
  function countTree(node: ContentNode) {
    totalNodes += 1;
    for (const child of node.children ?? []) {
      countTree(child);
    }
  }
  countTree(page.root);
  if (totalNodes > customCodeLimits.maxNodes) {
    return { ok: false, errors: [{ code: "tree.too_large", message: "Page has too many nodes." }] };
  }
  return { ok: true, content: page };
}

export function collectPageDiagnostics(
  page: PageContentV5,
  opts?: { theme?: Theme; isHome?: boolean },
): PageDiagnostic[] {
  const diagnostics: PageDiagnostic[] = [];
  if (!page || page.schemaVersion !== 5 || !page.root) return diagnostics;

  if (page.css && page.css.trim()) {
    const cssRes = sanitizeCustomCss(page.css);
    cssRes.errors.forEach((msg, index) => {
      diagnostics.push({
        id: `css-${index}`,
        source: "css",
        severity: "error",
        message: msg,
        hint: "Edit Page CSS without selecting an element.",
      });
    });
  }

  const seenIds = new Set<string>();
  function visit(node: ContentNode) {
    if (seenIds.has(node.id)) {
      diagnostics.push({
        id: `dup-${node.id}`,
        source: "node",
        severity: "error",
        nodeId: node.id,
        message: `Duplicate element ID "${node.id}".`,
        hint: "Duplicate or remove one of the conflicting elements.",
      });
    }
    seenIds.add(node.id);

    if (node.type === "smart") {
      const kind = String(node.props?.kind ?? "");
      if (!KNOWN_SMART_KINDS.has(kind)) {
        diagnostics.push({
          id: `kind-${node.id}`,
          source: "node",
          severity: "error",
          nodeId: node.id,
          message: `Unknown section kind "${kind}".`,
        });
      }
    }

    if (node.type === "html") {
      const res = sanitizeHtml(String(node.props?.html ?? ""));
      if (!res.ok) {
        diagnostics.push({
          id: `html-${node.id}`,
          source: "node",
          severity: "warning",
          nodeId: node.id,
          message: res.errors.join(" "),
          hint: "Unsafe tags and inline handlers are stripped automatically when published.",
        });
      }
    }

    if (node.type === "richtext" && node.props?.doc) {
      const res = sanitizeRichText(node.props.doc as RichNode);
      if (!res.ok) {
        diagnostics.push({
          id: `rt-${node.id}`,
          source: "node",
          severity: "warning",
          nodeId: node.id,
          message: res.errors.join(" "),
          hint: "Use https://, mailto:, tel:, or / links.",
        });
      }
    }

    if (node.styles) {
      for (const [styleKey, decls] of Object.entries(node.styles)) {
        if (!decls) continue;
        for (const [prop, val] of Object.entries(decls)) {
          const checked = validateStyleValue(prop, val);
          if (!checked.ok) {
            diagnostics.push({
              id: `style-${node.id}-${styleKey}-${prop}`,
              source: "node",
              severity: "error",
              nodeId: node.id,
              prop,
              styleKey,
              message: checked.error,
              hint: `Check "${prop}" in the Style tab (${styleKey}).`,
            });
          }
        }
      }
    }

    if (Array.isArray(node.classes)) {
      for (const cls of node.classes) {
        if (PROTECTED_CLASSES.has(cls)) {
          diagnostics.push({
            id: `cls-${node.id}-${cls}`,
            source: "node",
            severity: "error",
            nodeId: node.id,
            message: `Class "${cls}" is protected and cannot be used here.`,
            hint: "Remove this class name in the Advanced tab.",
          });
        }
      }
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  visit(page.root);

  const topBlocks = (page.root.children ?? [])
    .filter((child) => child.type === "smart")
    .map((child) => ({
      id: child.id,
      type: String(child.props?.kind ?? "text"),
      props: child.props,
    }));

  if (topBlocks.length > 0 && opts?.theme) {
    const layout = lintLayout({ theme: opts.theme, blocks: topBlocks });
    for (const issue of layout.issues) {
      if (opts.isHome === false && issue.id === "hero_first") continue;
      diagnostics.push({
        id: `layout-${issue.id}-${issue.blockId ?? "page"}`,
        source: "layout",
        severity: issue.severity,
        nodeId: issue.blockId,
        message: issue.message,
      });
    }
  }

  return diagnostics;
}

const baseBlockObjectSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  props: z.record(z.string(), z.unknown()).default({}),
  sec: z.record(z.string(), z.unknown()).optional(),
  sampleOnly: z.boolean().optional(),
  includeIf: z.string().optional(),
});

function refineBlock(
  val: z.infer<typeof baseBlockObjectSchema>,
  ctx: z.RefinementCtx,
): void {
  if (val.type === "faq") {
    const items = val.props?.items;
    if (!Array.isArray(items) || items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["props", "items"],
        message: "FAQ sections must have at least one item.",
      });
    }
  }
}

export const blockSchema = baseBlockObjectSchema.superRefine(refineBlock);

export const blockWithIdSchema = baseBlockObjectSchema
  .extend({
    id: z.string().min(1),
  })
  .superRefine(refineBlock);

export const contentSchema = z.object({
  schemaVersion: z.number().int().min(1).max(5).default(4),
  blocks: z.array(blockWithIdSchema).max(60),
});

export function validateContent(
  raw: unknown,
):
  | { ok: true; content: { schemaVersion: number; blocks: Block[] } }
  | { ok: false; errors: string[] } {
  const normalized = Array.isArray(raw) ? { schemaVersion: 4, blocks: raw } : raw;
  const parsed = contentSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return {
    ok: true,
    content: {
      schemaVersion: parsed.data.schemaVersion,
      blocks: parsed.data.blocks as Block[],
    },
  };
}

export type LayoutIssue = {
  id: string;
  severity: "error" | "warning";
  blockId?: string;
  message: string;
  autofix?: {
    blockId: string;
    props: Record<string, unknown>;
  };
};

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return 4.5;
  const l1 = luminance(rgbA);
  const l2 = luminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function lintLayout(input: {
  theme?: Theme;
  blocks: Array<{ id: string; type: string; props?: Record<string, unknown>; sec?: Record<string, unknown> }>;
}): { ok: boolean; errors: LayoutIssue[]; warnings: LayoutIssue[]; issues: LayoutIssue[] } {
  const issues: LayoutIssue[] = [];
  const blocks = input.blocks ?? [];

  if (blocks.length === 0 || blocks[0]?.type !== "hero") {
    issues.push({
      id: "hero_first",
      severity: "error",
      blockId: blocks[0]?.id,
      message: "The home page should start with a hero section.",
    });
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    const props = block.props ?? {};
    const sec = block.sec as { shape?: { top?: string; bottom?: string } } | undefined;

    if (sec?.shape && (i === 0 || i === blocks.length - 1)) {
      issues.push({
        id: "shape_not_on_edges",
        severity: "error",
        blockId: block.id,
        message: "Section divider shapes should not appear on outer edges.",
      });
    }

    if (
      block.type === "text" &&
      !String(props.text ?? "").trim() &&
      !String(props.heading ?? "").trim()
    ) {
      issues.push({
        id: "no_empty_sections",
        severity: "error",
        blockId: block.id,
        message: "Remove empty text sections.",
      });
    }

    if (typeof props.monogram === "string" && props.monogram.trim().length > 0) {
      issues.push({
        id: "no_letter_mark",
        severity: "error",
        blockId: block.id,
        message: "Avoid decorative single-letter monograms.",
      });
    }

    if (block.type === "hero") {
      const heading = String(props.heading ?? "");
      if (props.layout === "editorial" && heading.length > 60) {
        issues.push({
          id: "text_within_variant_limits",
          severity: "error",
          blockId: block.id,
          message: "Editorial hero heading should be 60 characters or fewer.",
        });
      }
      if (props.button3Label) {
        issues.push({
          id: "text_within_variant_limits",
          severity: "error",
          blockId: block.id,
          message: "Keep at most two hero action buttons.",
        });
      }
    }

    if (i > 0) {
      const prev = blocks[i - 1]!;
      const curLayout = String(props.layout ?? "");
      const prevLayout = String(prev.props?.layout ?? "");
      if (block.type === prev.type && curLayout && curLayout === prevLayout) {
        const altLayout = curLayout === "rows" ? "bento" : "grid";
        issues.push({
          id: "no_adjacent_same_layout",
          severity: "warning",
          blockId: block.id,
          message: `Adjacent ${block.type} sections share layout "${curLayout}".`,
          autofix: {
            blockId: block.id,
            props: { ...props, layout: altLayout },
          },
        });
      }
    }
  }

  const colors = resolveThemeColors(input.theme);
  if (contrastRatio(colors.text, colors.background) < 4.5) {
    issues.push({
      id: "min_contrast",
      severity: "error",
      message: "Text contrast against background is below 4.5:1.",
    });
  }

  const errors = issues.filter((item) => item.severity === "error");
  const warnings = issues.filter((item) => item.severity === "warning");
  return { ok: errors.length === 0, errors, warnings, issues };
}

export function applyLayoutAutofixes<
  T extends { id: string; type: string; props?: Record<string, unknown>; sec?: Record<string, unknown> },
>(blocks: T[], theme?: Theme): T[] {
  const linted = lintLayout({ blocks, theme });
  const fixes = new Map<string, Record<string, unknown>>();
  for (const issue of linted.issues) {
    if (issue.autofix) {
      fixes.set(issue.autofix.blockId, issue.autofix.props);
    }
  }
  return blocks.map((block) => {
    const patch = fixes.get(block.id);
    if (!patch) return block;
    return { ...block, props: patch };
  });
}
