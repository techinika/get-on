import { z } from 'zod';
import { blockSchema, linkTargetSchema } from '../schemas';
import { ICON_NAMES } from '../icons';
import type {
  ContentNode,
  FieldKey,
  NodeAttrs,
  NodeType,
  PageContentV5,
  TreeIssue,
  ValidationResult,
} from './types';
import { NODE_TYPES } from './types';
import {
  MAX_CLASSES,
  MAX_DATA_ATTRS,
  MAX_DEPTH,
  MAX_DOCUMENT_BYTES,
  MAX_HTML_NODES,
  MAX_NODES,
  MAX_NODE_TEXT,
  MAX_NOTE_LENGTH,
} from './limits';
import { isContainerType, isValidNodeId, treeDepth, countNodes, walkNodes } from './tree';
import { normalizeStyleSet } from './style';
import { sanitizeHtml } from './html';
import { sanitizeRichText, richTextToPlain } from './rich-text';

const FIELD_KEYS = new Set<string>([
  'business.name',
  'business.tagline',
  'business.description',
  'business.type',
  'contact.phone',
  'contact.email',
  'contact.address',
  'contact.whatsapp',
  'contact.hours',
  'contact.mapUrl',
  'page.title',
]);

const INCLUDE_IF = new Set(['phone', 'email', 'address', 'hours', 'social', 'logo', 'description', 'tagline', 'city', 'areaServed']);
const CLASS_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const ATTR_ID = /^[a-z][a-z0-9-]{0,39}$/;
const DATA_KEY = /^[a-z][a-z0-9-]{0,30}$/;
const ROLE = /^[a-z][a-z0-9-]{0,30}$/;

const hiddenSchema = z.object({
  all: z.boolean().optional(),
  computer: z.boolean().optional(),
  tablet: z.boolean().optional(),
  phone: z.boolean().optional(),
}).optional();

const nodeSchema: z.ZodType<ContentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(NODE_TYPES),
    props: z.record(z.unknown()).optional(),
    styles: z.record(z.unknown()).optional(),
    classes: z.array(z.string()).optional(),
    attrs: z.object({
      id: z.string().optional(),
      role: z.string().optional(),
      ariaLabel: z.string().optional(),
      ariaHidden: z.boolean().optional(),
      data: z.record(z.string()).optional(),
    }).passthrough().optional(),
    locked: z.boolean().optional(),
    hidden: hiddenSchema,
    note: z.string().optional(),
    requiresPlugin: z.string().optional(),
    sampleOnly: z.boolean().optional(),
    children: z.array(nodeSchema).optional(),
  }),
);

export const pageContentV5Schema = z.object({
  schemaVersion: z.literal(5),
  root: nodeSchema,
  css: z.string().optional(),
  meta: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    editorVersion: z.number().optional(),
    migratedFrom: z.number().optional(),
    migratedAt: z.string().optional(),
  }).optional(),
});

export type ValidateOptions = {
  enabledPlugins?: string[];
  htmlNodeLimit?: number;
  patternIds?: Set<string>;
  strictPatterns?: boolean;
};

function isUuid(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeAttrs(attrs: unknown, issues: TreeIssue[], path: string): NodeAttrs | undefined {
  if (!attrs || typeof attrs !== 'object') return undefined;
  const input = attrs as Record<string, unknown>;
  const out: NodeAttrs = {};
  if (input.id != null) {
    if (typeof input.id !== 'string' || !ATTR_ID.test(input.id)) {
      issues.push({ path, code: 'attrs.id', message: 'The element ID must be lowercase letters, numbers and dashes.' });
    } else out.id = input.id;
  }
  if (input.role != null) {
    if (typeof input.role !== 'string' || !ROLE.test(input.role)) {
      issues.push({ path, code: 'attrs.role', message: 'That role is not allowed.' });
    } else out.role = input.role;
  }
  if (input.ariaLabel != null) {
    if (typeof input.ariaLabel !== 'string' || input.ariaLabel.length > 100) {
      issues.push({ path, code: 'attrs.ariaLabel', message: 'The accessible label is too long.' });
    } else out.ariaLabel = input.ariaLabel;
  }
  if (typeof input.ariaHidden === 'boolean') out.ariaHidden = input.ariaHidden;
  if (input.data && typeof input.data === 'object') {
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.data as Record<string, unknown>)) {
      if (Object.keys(data).length >= MAX_DATA_ATTRS) {
        issues.push({ path, code: 'attrs.data', message: `Use at most ${MAX_DATA_ATTRS} data attributes.` });
        break;
      }
      if (!DATA_KEY.test(key)) {
        issues.push({ path, code: 'attrs.data', message: `"${key}" is not a valid data attribute name.` });
        continue;
      }
      if (typeof value !== 'string' || value.length > 200) {
        issues.push({ path, code: 'attrs.data', message: 'Data attribute values must be short text.' });
        continue;
      }
      data[key] = value;
    }
    if (Object.keys(data).length > 0) out.data = data;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeClasses(classes: unknown, issues: TreeIssue[], path: string): string[] | undefined {
  if (!Array.isArray(classes)) return undefined;
  const out: string[] = [];
  for (const value of classes) {
    if (typeof value !== 'string' || !CLASS_PATTERN.test(value)) {
      issues.push({ path, code: 'classes', message: 'Class names must be letters, numbers, dashes or underscores.' });
      continue;
    }
    if (/^gs-/i.test(value)) {
      issues.push({ path, code: 'classes', message: 'Class names starting with gs- are reserved.' });
      continue;
    }
    if (!out.includes(value)) out.push(value);
  }
  if (out.length > MAX_CLASSES) {
    issues.push({ path, code: 'classes', message: `Use at most ${MAX_CLASSES} classes.` });
    return out.slice(0, MAX_CLASSES);
  }
  return out.length ? out : undefined;
}

function normalizeNode(
  node: ContentNode,
  path: string,
  parentType: NodeType | null,
  issues: TreeIssue[],
  warnings: TreeIssue[],
  options: ValidateOptions,
  seenIds: Set<string>,
  htmlCount: { value: number },
): ContentNode | null {
  if (!isValidNodeId(node.id)) {
    issues.push({ path, code: 'id', message: 'This element has an invalid ID.' });
    return null;
  }
  if (seenIds.has(node.id)) {
    issues.push({ path, code: 'id.duplicate', message: 'Two elements share the same ID.' });
    return null;
  }
  seenIds.add(node.id);

  if (node.type === 'page') {
    if (path !== 'root') {
      issues.push({ path, code: 'page.nested', message: 'A page cannot be inside another element.' });
      return null;
    }
  } else if (parentType === null) {
    issues.push({ path, code: 'page.missing', message: 'The page root is missing.' });
    return null;
  }

  if (parentType === 'columns' && node.type !== 'column') {
    issues.push({ path, code: 'columns.child', message: 'Columns can only contain column elements.' });
    return null;
  }
  if (node.type === 'column' && parentType !== 'columns') {
    issues.push({ path, code: 'column.parent', message: 'A column must be inside a columns element.' });
    return null;
  }
  if (parentType === 'accordion' && node.type !== 'accordion-item') {
    issues.push({ path, code: 'accordion.child', message: 'An accordion can only contain accordion items.' });
    return null;
  }
  if (node.type === 'accordion-item' && parentType !== 'accordion') {
    issues.push({ path, code: 'accordionItem.parent', message: 'An accordion item must be inside an accordion.' });
    return null;
  }

  const isContainer = isContainerType(node.type);
  const children = node.children ?? [];
  if (!isContainer && children.length > 0) {
    issues.push({ path, code: 'leaf.children', message: 'This element cannot contain other elements.' });
    return null;
  }

  const out: ContentNode = {
    id: node.id,
    type: node.type,
  };
  if (node.locked) out.locked = true;
  if (node.sampleOnly) out.sampleOnly = true;
  if (node.note != null) {
    if (typeof node.note !== 'string' || node.note.length > MAX_NOTE_LENGTH) {
      issues.push({ path, code: 'note', message: 'The note is too long.' });
    } else if (node.note.trim()) out.note = node.note.trim();
  }
  if (node.requiresPlugin != null) {
    if (typeof node.requiresPlugin !== 'string' || !/^[a-z0-9-]{1,40}$/.test(node.requiresPlugin)) {
      issues.push({ path, code: 'plugin', message: 'That plugin name is not valid.' });
    } else {
      out.requiresPlugin = node.requiresPlugin;
      if (options.enabledPlugins && !options.enabledPlugins.includes(node.requiresPlugin)) {
        issues.push({ path, code: 'plugin.missing', message: 'This element needs a plugin that is not switched on for this website.' });
      }
    }
  }
  if (node.hidden) {
    const hidden = {
      ...(node.hidden.all ? { all: true } : {}),
      ...(node.hidden.computer ? { computer: true } : {}),
      ...(node.hidden.tablet ? { tablet: true } : {}),
      ...(node.hidden.phone ? { phone: true } : {}),
    };
    if (Object.keys(hidden).length > 0) out.hidden = hidden;
  }

  const classes = normalizeClasses(node.classes, issues, path);
  if (classes) out.classes = classes;
  const attrs = normalizeAttrs(node.attrs, issues, path);
  if (attrs) out.attrs = attrs;

  const styleResult = normalizeStyleSet(node.styles);
  if (!styleResult.ok) {
    for (const error of styleResult.errors) {
      issues.push({ path, code: 'style', message: `${error.prop}: ${error.message}` });
    }
  } else if (Object.keys(styleResult.styles).length > 0) {
    out.styles = styleResult.styles;
  }

  const props: Record<string, unknown> = { ...(node.props ?? {}) };
  const plainText = (key: string, max = MAX_NODE_TEXT): string | null => {
    const value = props[key];
    if (value == null) return '';
    if (typeof value !== 'string') return null;
    if (value.length > max) {
      issues.push({ path, code: 'text.length', message: 'This text is too long.' });
      return value.slice(0, max);
    }
    return value;
  };

  switch (node.type) {
    case 'page':
    case 'section':
    case 'container':
    case 'stack':
    case 'columns':
    case 'column':
    case 'grid':
    case 'accordion':
    case 'accordion-item': {
      if (node.type === 'section') {
        const name = plainText('name', 80);
        if (name != null) props.name = name;
      }
      if (node.type === 'accordion-item') {
        const title = plainText('title', 120);
        if (title != null) props.title = title;
        props.open = props.open === true;
      }
      break;
    }
    case 'heading': {
      const level = String(props.level ?? 'h2');
      if (!['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(level)) {
        issues.push({ path, code: 'heading.level', message: 'Choose a heading level from 1 to 6.' });
      } else props.level = level;
      if (props.rich != null) {
        const rich = sanitizeRichText(props.rich);
        if (!rich.ok) {
          for (const error of rich.errors) issues.push({ path, code: 'rich', message: error });
        }
        props.rich = rich.doc;
        props.text = rich.text;
      } else {
        const text = plainText('text');
        if (text == null) issues.push({ path, code: 'heading.text', message: 'Heading text must be text.' });
        else props.text = text;
      }
      break;
    }
    case 'text': {
      if (props.rich != null) {
        const rich = sanitizeRichText(props.rich);
        if (!rich.ok) {
          for (const error of rich.errors) issues.push({ path, code: 'rich', message: error });
        }
        props.rich = rich.doc;
        props.text = rich.text;
      } else {
        const text = plainText('text');
        if (text == null) issues.push({ path, code: 'text.text', message: 'Text must be text.' });
        else props.text = text;
      }
      break;
    }
    case 'list': {
      const items = props.items;
      if (!Array.isArray(items) || items.some((item) => typeof item !== 'string')) {
        issues.push({ path, code: 'list.items', message: 'List items must be text.' });
      } else if (items.length > 100) {
        issues.push({ path, code: 'list.items', message: 'Use at most 100 list items.' });
      } else {
        props.items = items.map((item) => item.slice(0, 500));
      }
      props.ordered = props.ordered === true;
      break;
    }
    case 'image': {
      if (props.imageId != null && props.imageId !== '' && !isUuid(props.imageId)) {
        issues.push({ path, code: 'image.id', message: 'Choose a picture from this website.' });
        props.imageId = null;
      }
      if (props.imageId === '') props.imageId = null;
      const alt = plainText('alt', 200);
      if (alt != null) props.alt = alt;
      break;
    }
    case 'button': {
      const label = plainText('label', 60);
      if (label != null) props.label = label;
      const link = linkTargetSchema.safeParse(props.link ?? { type: 'none' });
      if (!link.success) {
        issues.push({ path, code: 'button.link', message: 'Choose where this button goes.' });
        props.link = { type: 'none' };
      } else props.link = link.data;
      if (!['solid', 'outline', 'soft', 'plain'].includes(String(props.style ?? 'solid'))) props.style = 'solid';
      break;
    }
    case 'divider':
    case 'spacer': {
      const allowed = node.type === 'divider' ? ['line', 'dots', 'short'] : ['small', 'medium', 'large'];
      const key = node.type === 'divider' ? 'style' : 'height';
      if (!allowed.includes(String(props[key] ?? allowed[0]))) props[key] = allowed[0];
      break;
    }
    case 'video': {
      const url = plainText('url', 500);
      if (url == null) {
        issues.push({ path, code: 'video.url', message: 'The video address must be text.' });
      } else if (url && !/^https?:\/\//i.test(url)) {
        issues.push({ path, code: 'video.url', message: 'Use a video address that starts with https://.' });
        props.url = '';
      } else props.url = url;
      if (props.posterId != null && props.posterId !== '' && !isUuid(props.posterId)) props.posterId = null;
      break;
    }
    case 'icon': {
      const name = String(props.name ?? 'star');
      if (!ICON_NAMES.includes(name as (typeof ICON_NAMES)[number])) {
        issues.push({ path, code: 'icon.name', message: 'Choose an icon from the list.' });
        props.name = 'star';
      } else props.name = name;
      break;
    }
    case 'form': {
      if (!['contact', 'newsletter'].includes(String(props.kind ?? 'contact'))) props.kind = 'contact';
      break;
    }
    case 'html': {
      htmlCount.value += 1;
      const html = typeof props.html === 'string' ? props.html : '';
      const result = sanitizeHtml(html);
      if (!result.ok) {
        for (const error of result.errors) issues.push({ path, code: 'html', message: error });
      }
      props.html = result.html;
      break;
    }
    case 'field': {
      const key = String(props.key ?? '');
      if (!FIELD_KEYS.has(key)) {
        issues.push({ path, code: 'field.key', message: 'Choose a business detail for this field.' });
        props.key = 'business.name';
      }
      const fallback = plainText('fallback', 200);
      if (fallback != null) props.fallback = fallback;
      break;
    }
    case 'smart': {
      const kind = String(props.kind ?? '');
      if (kind === 'shared') {
        issues.push({ path, code: 'smart.shared', message: 'Use a synced pattern instead of a shared block.' });
        return null;
      }
      const blockProps = { ...props };
      delete blockProps.kind;
      const includeIf = blockProps.includeIf;
      const slotMeta = blockProps.slotMeta;
      delete blockProps.includeIf;
      delete blockProps.slotMeta;
      const parsed = blockSchema.safeParse({ type: kind, props: blockProps });
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        issues.push({ path, code: 'smart.invalid', message: first ? `${kind}: ${first.message}` : `"${kind}" is not a supported section.` });
        return null;
      }
      const parsedBlock = parsed.data as any;
      props.kind = kind;
      for (const key of Object.keys(blockProps)) delete props[key];
      Object.assign(props, parsedBlock.props ?? {});
      if (includeIf != null) {
        if (typeof includeIf !== 'string' || !INCLUDE_IF.has(includeIf)) {
          issues.push({ path, code: 'smart.includeIf', message: 'That display condition is not valid.' });
        } else props.includeIf = includeIf;
      }
      if (slotMeta && typeof slotMeta === 'object') props.slotMeta = slotMeta;
      break;
    }
    case 'reference': {
      const patternId = props.patternId;
      if (typeof patternId !== 'string' || patternId.length === 0 || patternId.length > 100) {
        issues.push({ path, code: 'reference.patternId', message: 'Choose a saved section.' });
      } else if (options.patternIds && !options.patternIds.has(patternId)) {
        const issue = { path, code: 'reference.missing', message: 'This saved section no longer exists. The page will show a placeholder.' };
        if (options.strictPatterns) issues.push(issue);
        else warnings.push(issue);
      }
      break;
    }
    default:
      break;
  }

  out.props = props;

  if (isContainer && node.type !== 'page') {
    out.children = children;
  }
  if (node.type === 'page') out.children = children;

  if (isContainer) {
    const cleanChildren: ContentNode[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = normalizeNode(children[i], `${path}.children[${i}]`, node.type, issues, warnings, options, seenIds, htmlCount);
      if (child) cleanChildren.push(child);
    }
    out.children = cleanChildren;
  }

  return out;
}

export function validateContentV5(raw: unknown, options: ValidateOptions = {}): ValidationResult {
  const parsed = pageContentV5Schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'content',
        code: 'schema',
        message: issue.message,
      })),
    };
  }
  const issues: TreeIssue[] = [];
  const warnings: TreeIssue[] = [];
  const seenIds = new Set<string>();
  const htmlCount = { value: 0 };
  const root = normalizeNode(parsed.data.root, 'root', null, issues, warnings, options, seenIds, htmlCount);
  if (!root || root.type !== 'page') {
    issues.push({ path: 'root', code: 'page.missing', message: 'The page root is missing.' });
    return { ok: false, errors: issues };
  }
  if (htmlCount.value > (options.htmlNodeLimit ?? MAX_HTML_NODES)) {
    issues.push({ path: 'root', code: 'html.limit', message: 'This page has too many HTML blocks.' });
  }
  const content: PageContentV5 = {
    schemaVersion: 5,
    root,
    ...(parsed.data.css ? { css: parsed.data.css } : {}),
    ...(parsed.data.meta ? { meta: parsed.data.meta } : {}),
  };
  if (countNodes(root) > MAX_NODES) {
    issues.push({ path: 'root', code: 'nodes.limit', message: `This page has more than ${MAX_NODES} elements.` });
  }
  if (treeDepth(root) > MAX_DEPTH) {
    issues.push({ path: 'root', code: 'depth.limit', message: 'This page is nested too deeply.' });
  }
  let bytes = 0;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(content)).length;
  } catch {
    bytes = MAX_DOCUMENT_BYTES + 1;
  }
  if (bytes > MAX_DOCUMENT_BYTES) {
    issues.push({ path: 'root', code: 'document.size', message: 'This page is too large to save.' });
  }
  if (issues.length > 0) return { ok: false, errors: issues };
  return { ok: true, content, warnings };
}

export function collectPageText(root: ContentNode): string {
  const parts: string[] = [];
  walkNodes(root, (node) => {
    if (node.type === 'heading' || node.type === 'text') {
      const rich = node.props?.rich;
      parts.push(rich ? richTextToPlain(rich as any) : String(node.props?.text ?? ''));
    } else if (node.type === 'list' && Array.isArray(node.props?.items)) {
      parts.push((node.props?.items as unknown[]).map(String).join(' '));
    }
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
