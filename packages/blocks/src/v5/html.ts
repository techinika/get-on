import { parseFragment, serialize } from 'parse5';
import { MAX_NODE_TEXT } from './limits';

export type HtmlSanitizeResult = {
  ok: boolean;
  html: string;
  text: string;
  errors: string[];
};

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins',
  'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre', 'hr', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'span', 'div', 'small', 'sup', 'sub', 'dl', 'dt', 'dd', 'abbr', 'time', 'address',
]);

const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
  'form', 'input', 'button', 'textarea', 'select', 'option', 'template',
  'noscript', 'svg', 'math', 'audio', 'video', 'source', 'track', 'canvas',
  'frame', 'frameset', 'applet', 'portal',
]);

const GLOBAL_ATTRS = new Set([
  'title', 'class', 'id', 'role', 'lang', 'dir',
  'aria-label', 'aria-hidden', 'aria-describedby', 'aria-labelledby',
]);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading', 'decoding']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  time: new Set(['datetime']),
};

const CLASS_PATTERN = /^[A-Za-z][A-Za-z0-9 _-]{0,80}$/;
const ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

function safeHref(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (text.startsWith('#')) return text;
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^mailto:[^\s]+$/i.test(text)) return text;
  if (/^tel:[+0-9()\s.-]{3,30}$/i.test(text)) return text;
  return null;
}

function safeSrc(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (text.startsWith('/assets/')) return text;
  if (/^https:\/\//i.test(text)) return text;
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]{1,200000}$/i.test(text)) return text;
  return null;
}

function cleanAttrs(tag: string, attrs: { name: string; value: string }[]): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  let dataCount = 0;
  for (const attr of attrs) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    if (name.startsWith('on')) continue;
    if (name === 'style' || name === 'srcdoc' || name === 'srcset') continue;
    const allowed = GLOBAL_ATTRS.has(name) || TAG_ATTRS[tag]?.has(name) || (name.startsWith('data-') && dataCount < 5);
    if (!allowed) continue;
    if (name.startsWith('data-')) dataCount += 1;
    if (name === 'class') {
      if (!CLASS_PATTERN.test(value)) continue;
      if (/gs-(?:watermark|protect)\b/i.test(value)) continue;
    }
    if (name === 'id' && !ID_PATTERN.test(value)) continue;
    if (name === 'href') {
      const href = safeHref(value);
      if (!href) continue;
      out.push({ name, value: href });
      continue;
    }
    if (name === 'src') {
      const src = safeSrc(value);
      if (!src) continue;
      out.push({ name, value: src });
      continue;
    }
    if (name === 'target' && value !== '_blank' && value !== '_self') continue;
    if (name === 'rel' && !/^(noopener|noreferrer|nofollow|ugc|sponsored)(\s+(noopener|noreferrer|nofollow|ugc|sponsored))*$/i.test(value)) continue;
    if ((name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan') && !/^\d{1,4}$/.test(value)) continue;
    if (name === 'aria-hidden' && value !== 'true' && value !== 'false') continue;
    if (name === 'dir' && !['ltr', 'rtl', 'auto'].includes(value)) continue;
    if (name === 'loading' && !['lazy', 'eager'].includes(value)) continue;
    if (name === 'decoding' && !['sync', 'async', 'auto'].includes(value)) continue;
    out.push({ name, value });
  }
  if (tag === 'a' && out.some((a) => a.name === 'target' && a.value === '_blank')) {
    if (!out.some((a) => a.name === 'rel')) out.push({ name: 'rel', value: 'noopener noreferrer' });
  }
  return out;
}

type AnyNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: AnyNode[];
  parentNode?: AnyNode | null;
};

function textContent(node: AnyNode): string {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(textContent).join(' ');
}

export function sanitizeHtml(input: string, options: { maxLength?: number } = {}): HtmlSanitizeResult {
  const errors: string[] = [];
  const maxLength = options.maxLength ?? MAX_NODE_TEXT;
  const text = (input ?? '').trim();
  if (!text) return { ok: true, html: '', text: '', errors };
  if (text.length > maxLength) {
    return { ok: false, html: '', text: '', errors: ['This HTML block is too long.'] };
  }
  let fragment: AnyNode;
  try {
    fragment = parseFragment(text) as unknown as AnyNode;
  } catch {
    return { ok: false, html: '', text: '', errors: ['There is a syntax error in this HTML block.'] };
  }

  const clean = (parent: AnyNode): void => {
    const children = [...(parent.childNodes ?? [])];
    for (const child of children) {
      if (child.nodeName === '#comment') {
        parent.childNodes = parent.childNodes?.filter((node) => node !== child);
        continue;
      }
      if (child.nodeName === '#text') continue;
      const tag = (child.tagName ?? child.nodeName).toLowerCase();
      if (DROP_TAGS.has(tag)) {
        errors.push(`<${tag}> is not allowed. Use an embed block instead.`);
        parent.childNodes = parent.childNodes?.filter((node) => node !== child);
        continue;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        const grandchildren = child.childNodes ?? [];
        const index = parent.childNodes?.indexOf(child) ?? -1;
        if (index >= 0) {
          parent.childNodes?.splice(index, 1, ...grandchildren);
          for (const grandchild of grandchildren) grandchild.parentNode = parent;
        }
        clean(parent);
        continue;
      }
      child.attrs = cleanAttrs(tag, child.attrs ?? []);
      clean(child);
    }
  };

  clean(fragment);
  const html = serialize(fragment as any).trim();
  const plain = textContent(fragment).replace(/\s+/g, ' ').trim();
  if (plain.length > maxLength) {
    return { ok: false, html: '', text: '', errors: ['This HTML block has too much text.'] };
  }
  return { ok: errors.length === 0, html, text: plain, errors };
}

export function assertHtmlSafe(html: string): string {
  const result = sanitizeHtml(html);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result.html;
}
