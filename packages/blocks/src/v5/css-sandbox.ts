import postcss, { type AtRule, type ChildNode, type Declaration, type Rule } from 'postcss';
import { MAX_CUSTOM_CSS_BYTES } from './limits';

export type CssSanitizeResult = {
  ok: boolean;
  css: string;
  errors: string[];
  warnings: string[];
};

const FORBIDDEN_AT_RULES = new Set([
  'import',
  'font-face',
  'property',
  'scope',
  'keyframes',
  '-webkit-keyframes',
  'page',
  'counter-style',
  'font-feature-values',
  'namespace',
  'document',
]);

const FORBIDDEN_PROPS = new Set([
  'behavior',
  '-moz-binding',
  'content',
  'src',
  'unicode-bidi',
  'direction',
]);

const PROTECTED_SELECTOR = /(?:^|[\s,>+~.#[])(?:gs-watermark|gs-protect|data-gs-protect)\b/i;
const UNSAFE_URL = /url\s*\(\s*(['"]?)(?!\/assets\/|data:image\/(?:png|jpe?g|gif|webp|avif);base64,)[^)]*\1\s*\)/i;

function splitSelectors(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of selector) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function scopeSelector(selector: string, root = '.gs-root'): string | null {
  const trimmed = selector.trim();
  if (!trimmed) return null;
  if (PROTECTED_SELECTOR.test(trimmed)) return null;
  if (trimmed === '*' || /(^|[\s,>+~])\*($|[\s,>+~])/.test(trimmed)) return null;
  if (trimmed.includes('@')) return null;
  if (/::?(?:before|after|marker|selection|placeholder|first-line|first-letter)/i.test(trimmed)) {
    return null;
  }
  if (/^:root\b/.test(trimmed)) return trimmed.replace(/^:root/, root);
  if (/^(html|body)\b/.test(trimmed)) return trimmed.replace(/^(html|body)/, root);
  if (trimmed.startsWith(root)) return trimmed;
  if (trimmed.startsWith('&')) return `${root}${trimmed.slice(1)}`;
  return `${root} ${trimmed}`;
}

function sanitizeDeclaration(decl: Declaration, errors: string[], warnings: string[]): void {
  const prop = decl.prop.trim().toLowerCase();
  if (FORBIDDEN_PROPS.has(prop)) {
    errors.push(`The "${prop}" property is not allowed.`);
    decl.remove();
    return;
  }
  if (decl.important) {
    errors.push('Remove !important. The editor keeps some parts of the page protected.');
    decl.important = false;
  }
  const value = decl.value.trim();
  if (/expression\s*\(|javascript:|vbscript:/i.test(value)) {
    errors.push('Scripts are not allowed in custom CSS.');
    decl.remove();
    return;
  }
  if (UNSAFE_URL.test(value)) {
    errors.push('Pictures in custom CSS must come from this website.');
    decl.remove();
    return;
  }
  if (prop === 'position' && value.toLowerCase() === 'fixed') {
    warnings.push('Fixed positioning was changed to sticky so the page stays scrollable.');
    decl.value = 'sticky';
  }
}

function sanitizeAtRule(atRule: AtRule, errors: string[]): boolean {
  const name = atRule.name.toLowerCase();
  if (FORBIDDEN_AT_RULES.has(name)) {
    errors.push(`@${name} is not allowed in custom CSS.`);
    return false;
  }
  if (name === 'layer' || name === 'charset' || name === 'tailwind' || name === 'apply') {
    errors.push(`@${name} is not allowed in custom CSS.`);
    return false;
  }
  if (name === 'media') {
    if (!/^[\s\w():.,<>=/%-]+$/.test(atRule.params) || /@|;|\{|\}/.test(atRule.params)) {
      errors.push('That media query is not allowed.');
      return false;
    }
    return true;
  }
  if (name === 'supports' || name === 'container') {
    if (!/^[\s\w():.,<>=/%-]+$/.test(atRule.params) || /@|;|\{|\}/.test(atRule.params)) {
      errors.push(`That @${name} rule is not allowed.`);
      return false;
    }
    return true;
  }
  errors.push(`@${name} is not allowed in custom CSS.`);
  return false;
}

export function sanitizeCustomCss(input: string, options: { maxBytes?: number } = {}): CssSanitizeResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxBytes = options.maxBytes ?? MAX_CUSTOM_CSS_BYTES;
  const text = (input ?? '').trim();
  if (!text) return { ok: true, css: '', errors, warnings };
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, css: '', errors: [`Custom CSS is over the ${Math.round(maxBytes / 1024)} KB limit.`], warnings };
  }
  let root: postcss.Root;
  try {
    root = postcss.parse(text);
  } catch {
    return { ok: false, css: '', errors: ['There is a syntax error in the custom CSS.'], warnings };
  }

  root.walk((node: ChildNode) => {
    if (node.type === 'rule') {
      const rule = node as Rule;
      const selectors = splitSelectors(rule.selector)
        .map((selector) => scopeSelector(selector))
        .filter((selector): selector is string => Boolean(selector));
      if (selectors.length === 0) {
        errors.push('A selector in the custom CSS is not allowed.');
        rule.remove();
        return;
      }
      rule.selector = selectors.join(',');
    } else if (node.type === 'atrule') {
      const atRule = node as AtRule;
      if (!sanitizeAtRule(atRule, errors)) {
        atRule.remove();
      }
    } else if (node.type === 'decl') {
      sanitizeDeclaration(node as Declaration, errors, warnings);
    }
  });

  const css = root
    .toString()
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};:,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
  if (new TextEncoder().encode(css).length > maxBytes) {
    errors.push(`Custom CSS is over the ${Math.round(maxBytes / 1024)} KB limit.`);
  }
  return { ok: errors.length === 0, css: errors.length === 0 ? css : '', errors, warnings };
}

export function assertCustomCssSafe(css: string): void {
  const result = sanitizeCustomCss(css);
  if (!result.ok) throw new Error(result.errors.join(' '));
}
