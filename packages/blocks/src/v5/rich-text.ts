import { MAX_DEPTH, MAX_NODE_TEXT } from './limits';
import type { FieldKey } from './types';

export type RichMark = { type: string; attrs?: Record<string, unknown> };
export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: RichMark[];
  text?: string;
  content?: RichNode[];
};
export type RichDoc = RichNode & { type: 'doc' };

const BLOCK_NODES = new Set([
  'doc',
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'horizontalRule',
]);

const MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link']);
const FIELD_KEYS = new Set<FieldKey>([
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

function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  if (text.startsWith('#')) return text;
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^mailto:[^\s]+$/i.test(text)) return text;
  if (/^tel:[+0-9()\s.-]{3,30}$/i.test(text)) return text;
  return null;
}

export type RichTextResult =
  | { ok: true; doc: RichDoc; text: string; length: number }
  | { ok: false; doc: RichDoc; text: string; length: number; errors: string[] };

function plainFrom(nodes: RichNode[] | undefined, parts: string[] = []): string[] {
  for (const node of nodes ?? []) {
    if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text);
    else if (node.type === 'hardBreak') parts.push('\n');
    else if (node.type === 'dynamicField') {
      const fallback = node.attrs?.fallback;
      parts.push(typeof fallback === 'string' ? fallback : '');
    } else plainFrom(node.content, parts);
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem' || node.type === 'blockquote' || node.type === 'codeBlock') parts.push('\n');
  }
  return parts;
}

export function richTextToPlain(doc: RichNode | string | null | undefined): string {
  if (typeof doc === 'string') return doc;
  if (!doc) return '';
  return plainFrom([doc]).join('').replace(/\n{3,}/g, '\n\n').trim();
}

export function richTextLength(doc: RichNode | string | null | undefined): number {
  return richTextToPlain(doc).length;
}

export function richTextFromPlain(text: string): RichDoc {
  const lines = text.split(/\n{2,}/);
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line.length > 0 ? [{ type: 'text', text: line }] : undefined,
    })),
  };
}

function sanitizeNode(node: RichNode, depth: number, errors: string[]): RichNode | null {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
    errors.push('This text contains an unknown item.');
    return null;
  }
  if (depth > MAX_DEPTH) {
    errors.push('This text is nested too deeply.');
    return null;
  }
  if (node.type === 'text') {
    if (typeof node.text !== 'string') {
      errors.push('This text contains an invalid item.');
      return null;
    }
    const marks: RichMark[] = [];
    for (const mark of node.marks ?? []) {
      if (!mark || typeof mark.type !== 'string' || !MARKS.has(mark.type)) {
        errors.push('This text has an unsupported style.');
        continue;
      }
      if (mark.type === 'link') {
        const href = safeHref(mark.attrs?.href);
        if (!href) {
          errors.push('A link in this text is not safe.');
          continue;
        }
        marks.push({ type: 'link', attrs: { href, ...(mark.attrs?.target === '_blank' ? { target: '_blank' } : {}) } });
        continue;
      }
      marks.push({ type: mark.type });
    }
    return { type: 'text', text: node.text, ...(marks.length ? { marks } : {}) };
  }
  if (node.type === 'dynamicField') {
    const key = node.attrs?.key;
    if (typeof key !== 'string' || !FIELD_KEYS.has(key as FieldKey)) {
      errors.push('This text uses a field that does not exist.');
      return null;
    }
    const fallback = typeof node.attrs?.fallback === 'string' ? node.attrs.fallback.slice(0, 200) : undefined;
    return { type: 'dynamicField', attrs: { key, ...(fallback ? { fallback } : {}) } };
  }
  if (!BLOCK_NODES.has(node.type)) {
    errors.push('This text contains an unsupported item.');
    return null;
  }
  const out: RichNode = { type: node.type };
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 2);
    if (![1, 2, 3, 4].includes(level)) {
      errors.push('Headings in text can only be levels 1 to 4.');
      return null;
    }
    out.attrs = { level };
  }
  if (node.type === 'orderedList') {
    const start = Number(node.attrs?.start ?? 1);
    out.attrs = { start: Number.isFinite(start) && start > 0 ? Math.min(start, 9999) : 1 };
  }
  if (node.type === 'codeBlock') {
    const language = node.attrs?.language;
    if (typeof language === 'string' && /^[a-z0-9+#-]{1,20}$/i.test(language)) out.attrs = { language };
  }
  const children: RichNode[] = [];
  for (const child of node.content ?? []) {
    const clean = sanitizeNode(child, depth + 1, errors);
    if (clean) children.push(clean);
  }
  if (children.length > 0) out.content = children;
  return out;
}

export function sanitizeRichText(input: unknown): RichTextResult {
  const errors: string[] = [];
  if (typeof input === 'string') {
    const text = input.slice(0, MAX_NODE_TEXT);
    const doc = richTextFromPlain(text);
    if (input.length > MAX_NODE_TEXT) errors.push('This text is too long.');
    return { ok: errors.length === 0, doc, text, length: text.length, ...(errors.length ? { errors } : {}) } as RichTextResult;
  }
  if (!input || typeof input !== 'object') {
    const doc = richTextFromPlain('');
    return { ok: false, doc, text: '', length: 0, errors: ['This text is empty or invalid.'] };
  }
  const doc = sanitizeNode(input as RichNode, 0, errors);
  if (!doc || doc.type !== 'doc') {
    const empty = richTextFromPlain('');
    return { ok: false, doc: empty, text: '', length: 0, errors: errors.length ? errors : ['This text is invalid.'] };
  }
  const text = richTextToPlain(doc);
  if (text.length > MAX_NODE_TEXT) errors.push('This text is too long.');
  return { ok: errors.length === 0, doc, text, length: text.length, ...(errors.length ? { errors } : {}) } as RichTextResult;
}

export function assertRichText(input: unknown): RichDoc {
  const result = sanitizeRichText(input);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result.doc;
}
