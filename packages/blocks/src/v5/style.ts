import type { CompiledStyles, ContentNode, Declarations, StyleSet, StyleValue } from './types';
import { MAX_STYLE_PROPERTIES } from './limits';
import { walkNodes } from './tree';
import { sanitizeCustomCss } from './css-sandbox';

export const THEME_TOKENS = [
  'primary',
  'primary-hover',
  'accent',
  'bg',
  'text',
  'soft',
  'on-primary',
  'on-accent',
  'link',
  'muted',
  'card',
  'card-border',
  'border',
  'icon-tile',
  'shadow',
  'scrim',
  'overlay',
  'on-overlay',
  'error',
  'radius',
  'radius-lg',
  'radius-btn',
  'font-heading',
  'font-body',
  'h1',
  'h2',
  'h3',
  'body',
  'small',
  'pad-y',
  'gap',
  'display',
  'hero-pad-y',
  'measure',
  'gutter',
  'eyebrow-gap',
  'title-gap',
  'stack',
  'heading-case',
  'heading-tracking',
  'wordmark-size',
  'wordmark-tracking',
  'wordmark-weight',
  'wordmark-case',
  'field-bg',
  'field-text',
  'field-border',
  'placeholder',
  'focus-ring',
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];

const TOKEN_SET = new Set<string>(THEME_TOKENS);

const HEX = /^#[0-9A-Fa-f]{3,8}$/;
const TOKEN = /^\{([a-z0-9-]+)\}$/;
const LENGTH = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|vw|vh|vmin|vmax|ch|ex|fr|deg|ms|s)?$/;
const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const URL = /^url\(\s*(['"]?)(\/assets\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+|data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]{1,200000})\1\s*\)$/;

const COLOUR_PROPS = new Set([
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'caret-color',
  'accent-color',
  'fill',
  'stroke',
]);

const LENGTH_PROPS = new Set([
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'row-gap',
  'column-gap',
  'font-size',
  'letter-spacing',
  'text-indent',
  'border-width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'outline-width',
  'outline-offset',
  'text-underline-offset',
  'text-decoration-thickness',
  'scroll-margin-top',
  'flex-basis',
  'column-rule-width',
  'column-width',
  'grid-auto-columns',
  'grid-auto-rows',
]);

const UNITLESS_PROPS = new Set([
  'opacity',
  'z-index',
  'font-weight',
  'line-height',
  'flex',
  'flex-grow',
  'flex-shrink',
  'order',
  'column-count',
  'aspect-ratio',
  'scale',
  'rotate',
  'grid-column',
  'grid-row',
]);

const KEYWORDS: Record<string, readonly string[]> = {
  display: ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'none', 'contents', 'flow-root', 'table', 'table-cell'],
  position: ['relative', 'absolute', 'sticky', 'static'],
  'box-sizing': ['border-box', 'content-box'],
  overflow: ['visible', 'hidden', 'clip', 'scroll', 'auto'],
  'overflow-x': ['visible', 'hidden', 'clip', 'scroll', 'auto'],
  'overflow-y': ['visible', 'hidden', 'clip', 'scroll', 'auto'],
  'flex-direction': ['row', 'row-reverse', 'column', 'column-reverse'],
  'flex-wrap': ['nowrap', 'wrap', 'wrap-reverse'],
  'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end', 'stretch', 'normal'],
  'align-items': ['stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end', 'normal'],
  'align-content': ['stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end', 'normal'],
  'align-self': ['auto', 'stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end'],
  'justify-items': ['start', 'end', 'center', 'stretch', 'normal'],
  'justify-self': ['auto', 'start', 'end', 'center', 'stretch', 'normal'],
  'place-items': ['start', 'end', 'center', 'stretch', 'normal'],
  'place-content': ['start', 'end', 'center', 'stretch', 'space-between', 'space-around', 'space-evenly', 'normal'],
  'text-align': ['left', 'right', 'center', 'justify', 'start', 'end'],
  'text-decoration': ['none', 'underline', 'overline', 'line-through'],
  'text-transform': ['none', 'uppercase', 'lowercase', 'capitalize'],
  'font-style': ['normal', 'italic', 'oblique'],
  'font-family': ['inherit', 'initial', 'unset'],
  'white-space': ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'],
  'word-break': ['normal', 'break-all', 'keep-all', 'break-word'],
  'overflow-wrap': ['normal', 'anywhere', 'break-word'],
  'text-wrap': ['wrap', 'nowrap', 'balance', 'pretty'],
  'background-repeat': ['repeat', 'repeat-x', 'repeat-y', 'no-repeat', 'space', 'round'],
  'background-size': ['auto', 'cover', 'contain'],
  'background-position': ['left', 'right', 'center', 'top', 'bottom'],
  'background-attachment': ['scroll', 'local'],
  'background-clip': ['border-box', 'padding-box', 'content-box', 'text'],
  'background-origin': ['border-box', 'padding-box', 'content-box'],
  'border-style': ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'],
  'outline-style': ['none', 'solid', 'dashed', 'dotted', 'double'],
  'object-fit': ['fill', 'contain', 'cover', 'none', 'scale-down'],
  'object-position': ['left', 'right', 'center', 'top', 'bottom'],
  visibility: ['visible', 'hidden', 'collapse'],
  cursor: ['auto', 'default', 'pointer', 'text', 'move', 'grab', 'grabbing', 'not-allowed', 'wait', 'help', 'zoom-in', 'zoom-out'],
  'list-style-type': ['none', 'disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'],
  'list-style-position': ['inside', 'outside'],
  'vertical-align': ['baseline', 'middle', 'top', 'bottom', 'sub', 'super', 'text-top', 'text-bottom'],
  'transform-origin': ['center', 'top', 'bottom', 'left', 'right'],
  isolation: ['auto', 'isolate'],
  'mix-blend-mode': ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'],
  'grid-auto-flow': ['row', 'column', 'dense', 'row dense', 'column dense'],
  float: ['none', 'left', 'right'],
  clear: ['none', 'left', 'right', 'both'],
  'column-rule-style': ['none', 'solid', 'dashed', 'dotted', 'double'],
  'text-emphasis-style': ['none', 'dot', 'circle', 'double-circle', 'triangle', 'sesame', 'filled', 'open'],
};

const ALLOWED_PROPS = new Set<string>([
  ...Object.keys(KEYWORDS),
  ...COLOUR_PROPS,
  ...LENGTH_PROPS,
  ...UNITLESS_PROPS,
  'inset',
  'flex',
  'flex-flow',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'grid-auto-columns',
  'grid-auto-rows',
  'grid-area',
  'background-color',
  'background-image',
  'background',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'box-shadow',
  'text-shadow',
  'opacity',
  'transform',
  'transform-origin',
  'transition',
  'filter',
  'backdrop-filter',
  'clip-path',
  'aspect-ratio',
  'columns',
  'column-count',
  'column-width',
  'column-gap',
  'column-rule',
  'column-rule-color',
  'column-rule-width',
  'column-rule-style',
  'scroll-behavior',
  'scroll-margin-top',
  'text-decoration-thickness',
  'text-underline-offset',
  'caret-color',
  'accent-color',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'width',
  'height',
]);

export type StyleGroup = {
  id: string;
  label: string;
  props: { prop: string; label: string; control: 'text' | 'length' | 'colour' | 'select' | 'number' | 'shadow' | 'transform' }[];
};

export const STYLE_GROUPS: StyleGroup[] = [
  {
    id: 'layout',
    label: 'Layout',
    props: [
      { prop: 'display', label: 'Display', control: 'select' },
      { prop: 'position', label: 'Position', control: 'select' },
      { prop: 'top', label: 'Top', control: 'length' },
      { prop: 'right', label: 'Right', control: 'length' },
      { prop: 'bottom', label: 'Bottom', control: 'length' },
      { prop: 'left', label: 'Left', control: 'length' },
      { prop: 'z-index', label: 'Layer order', control: 'number' },
      { prop: 'overflow', label: 'Overflow', control: 'select' },
      { prop: 'aspect-ratio', label: 'Aspect ratio', control: 'text' },
    ],
  },
  {
    id: 'size',
    label: 'Size and spacing',
    props: [
      { prop: 'width', label: 'Width', control: 'length' },
      { prop: 'min-width', label: 'Min width', control: 'length' },
      { prop: 'max-width', label: 'Max width', control: 'length' },
      { prop: 'height', label: 'Height', control: 'length' },
      { prop: 'min-height', label: 'Min height', control: 'length' },
      { prop: 'max-height', label: 'Max height', control: 'length' },
      { prop: 'margin', label: 'Margin', control: 'length' },
      { prop: 'padding', label: 'Padding', control: 'length' },
      { prop: 'gap', label: 'Gap', control: 'length' },
    ],
  },
  {
    id: 'typography',
    label: 'Text',
    props: [
      { prop: 'font-family', label: 'Font', control: 'select' },
      { prop: 'font-size', label: 'Size', control: 'length' },
      { prop: 'font-weight', label: 'Weight', control: 'number' },
      { prop: 'line-height', label: 'Line height', control: 'number' },
      { prop: 'letter-spacing', label: 'Letter spacing', control: 'length' },
      { prop: 'text-align', label: 'Align', control: 'select' },
      { prop: 'text-transform', label: 'Case', control: 'select' },
      { prop: 'color', label: 'Colour', control: 'colour' },
    ],
  },
  {
    id: 'background',
    label: 'Background',
    props: [
      { prop: 'background-color', label: 'Colour', control: 'colour' },
      { prop: 'background-image', label: 'Image or gradient', control: 'text' },
      { prop: 'background-size', label: 'Size', control: 'select' },
      { prop: 'background-position', label: 'Position', control: 'text' },
      { prop: 'background-repeat', label: 'Repeat', control: 'select' },
    ],
  },
  {
    id: 'border',
    label: 'Border and corners',
    props: [
      { prop: 'border', label: 'Border', control: 'text' },
      { prop: 'border-color', label: 'Border colour', control: 'colour' },
      { prop: 'border-radius', label: 'Corners', control: 'length' },
      { prop: 'box-shadow', label: 'Shadow', control: 'shadow' },
      { prop: 'outline', label: 'Outline', control: 'text' },
    ],
  },
  {
    id: 'effects',
    label: 'Effects',
    props: [
      { prop: 'opacity', label: 'Opacity', control: 'number' },
      { prop: 'transform', label: 'Move and scale', control: 'transform' },
      { prop: 'filter', label: 'Filter', control: 'text' },
      { prop: 'clip-path', label: 'Shape', control: 'text' },
      { prop: 'transition', label: 'Animation', control: 'text' },
    ],
  },
];

export type StyleValidation = {
  ok: boolean;
  styles: StyleSet;
  errors: { prop: string; message: string }[];
};

function isToken(value: string): value is `{${string}}` {
  return TOKEN.test(value);
}

function tokenToVar(value: string): string {
  return `var(--s-${value.slice(1, -1)})`;
}

export function resolveStyleValue(prop: string, value: StyleValue): string {
  const text = typeof value === 'number' ? String(value) : value.trim();
  if (isToken(text)) return tokenToVar(text);
  if (COLOUR_PROPS.has(prop) && HEX.test(text)) return text;
  if (prop === 'font-family' && text === '{heading}') return 'var(--s-font-heading)';
  if (prop === 'font-family' && text === '{body}') return 'var(--s-font-body)';
  if (LENGTH_PROPS.has(prop) && NUMBER.test(text) && text !== '0') return `${text}px`;
  return text;
}

function validColour(value: string): boolean {
  if (isToken(value)) return TOKEN_SET.has(value.slice(1, -1));
  if (HEX.test(value)) return true;
  if (['transparent', 'currentColor', 'inherit', 'initial', 'unset'].includes(value)) return true;
  if (/^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/+-]+\)$/.test(value)) return true;
  return false;
}

function validLength(value: string, allowKeywords = true): boolean {
  if (isToken(value)) return TOKEN_SET.has(value.slice(1, -1));
  if (value === '0') return true;
  if (LENGTH.test(value)) return true;
  if (allowKeywords && ['auto', 'none', 'inherit', 'initial', 'unset', 'fit-content', 'min-content', 'max-content', 'stretch'].includes(value)) return true;
  return false;
}

function validGradient(value: string): boolean {
  if (value === 'none' || value === 'inherit' || value === 'initial' || value === 'unset') return true;
  const fn = /^(linear-gradient|radial-gradient|conic-gradient)\((.+)\)$/i.exec(value);
  if (!fn) return false;
  const parts = fn[2].split(/,(?![^(]*\))/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  for (const part of parts) {
    const cleaned = part.replace(/^(?:to\s+[a-z\s]+|[-+]?\d+(?:\.\d+)?deg|at\s+[a-z\s%]+|circle|ellipse|from\s+[-+]?\d+(?:\.\d+)?deg)/i, '').trim();
    if (!cleaned) continue;
    const colour = cleaned.replace(/^[-+]?\d+(?:\.\d+)?(%|px|em|rem)?\s*/, '').trim();
    if (!validColour(colour) && !/^[-+]?\d+(?:\.\d+)?(%|px|em|rem)?$/.test(colour)) return false;
  }
  return true;
}

function validUrlOrGradient(value: string): boolean {
  if (validGradient(value)) return true;
  return URL.test(value);
}

function validTransform(value: string): boolean {
  if (value === 'none') return true;
  const fn = /^(translate|translatex|translatey|translatez|scale|scalex|scaley|rotate|rotatex|rotatey|rotatez|skew|skewx|skewy)\(([^()]*)\)$/i;
  const parts = value.match(/[a-z]+\([^()]*\)/gi);
  if (!parts || parts.join(' ') !== value.replace(/\s+/g, ' ').trim()) return false;
  return parts.every((part) => {
    const m = fn.exec(part);
    if (!m) return false;
    const args = m[2].split(',').map((a) => a.trim());
    return args.length > 0 && args.length <= 3 && args.every((a) => NUMBER.test(a) || LENGTH.test(a) || a === '0');
  });
}

function validShadow(value: string): boolean {
  if (value === 'none' || value === 'inherit' || value === 'initial' || value === 'unset') return true;
  const tokens = value.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 7) return false;
  return tokens.every((token) => NUMBER.test(token) || LENGTH.test(token) || validColour(token) || ['inset', '0'].includes(token));
}

function validFilter(value: string): boolean {
  if (value === 'none') return true;
  const parts = value.match(/[a-z-]+\([^()]*\)/gi);
  if (!parts || parts.join(' ') !== value.replace(/\s+/g, ' ').trim()) return false;
  return parts.every((part) => /^(blur|brightness|contrast|grayscale|hue-rotate|invert|opacity|saturate|sepia)\([-+]?\d+(?:\.\d+)?(?:px|%|deg)?\)$/i.test(part));
}

function validClipPath(value: string): boolean {
  if (value === 'none') return true;
  return /^(inset|circle|ellipse|polygon)\([0-9.,%()\s-]+\)$/i.test(value);
}

function validTransition(value: string): boolean {
  if (value === 'none') return true;
  return value.split(',').every((part) => /^[a-z-]+(?:\s+[-+]?\d+(?:\.\d+)?m?s)?(?:\s+(?:ease|linear|ease-in|ease-out|ease-in-out|steps\([0-9]+\)))?$/i.test(part.trim()));
}

export function validateStyleValue(prop: string, value: StyleValue): { ok: boolean; value?: string; message?: string } {
  const key = prop.trim().toLowerCase();
  if (!ALLOWED_PROPS.has(key)) return { ok: false, message: 'This style is not supported.' };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { ok: false, message: 'Enter a number.' };
    if (key === 'opacity' && (value < 0 || value > 1)) return { ok: false, message: 'Opacity must be between 0 and 1.' };
    if (key === 'z-index' && (value < -10 || value > 9999)) return { ok: false, message: 'Layer order must be between -10 and 9999.' };
    if (key === 'font-weight' && (value < 100 || value > 900 || value % 100 !== 0)) return { ok: false, message: 'Weight must be 100 to 900.' };
    if (key === 'line-height' && (value < 0.5 || value > 4)) return { ok: false, message: 'Line height must be between 0.5 and 4.' };
    return { ok: true, value: resolveStyleValue(key, value) };
  }
  if (typeof value !== 'string') return { ok: false, message: 'Enter a value.' };
  const text = value.trim();
  if (text.length === 0) return { ok: true, value: '' };
  if (text.length > 300) return { ok: false, message: 'This value is too long.' };
  if (/[;<>]/.test(text)) return { ok: false, message: 'Remove ; < or >.' };
  if (/[{}]/.test(text) && !(isToken(text) && (COLOUR_PROPS.has(key) || key === 'font-family'))) {
    return { ok: false, message: 'Remove { or }.' };
  }
  if (/expression\s*\(|javascript:|url\s*\(\s*['"]?javascript/i.test(text)) return { ok: false, message: 'This value is not allowed.' };
  if (COLOUR_PROPS.has(key)) {
    if (!validColour(text)) return { ok: false, message: 'Use a colour token like {primary} or a hex colour.' };
    return { ok: true, value: resolveStyleValue(key, text) };
  }
  if (key === 'background-image') {
    if (!validUrlOrGradient(text)) return { ok: false, message: 'Use a gradient, none, or a picture from this website.' };
    return { ok: true, value: text };
  }
  if (key === 'font-family') {
    if (text === '{heading}' || text === '{body}' || text === 'inherit' || text === 'initial' || text === 'unset') {
      return { ok: true, value: resolveStyleValue(key, text) };
    }
    return { ok: false, message: 'Choose the heading font, the body font, or inherit.' };
  }
  if (key === 'transform') {
    if (!validTransform(text)) return { ok: false, message: 'Use move, scale or rotate values.' };
    return { ok: true, value: text };
  }
  if (key === 'box-shadow' || key === 'text-shadow') {
    if (!validShadow(text)) return { ok: false, message: 'Use a shadow like 0 8px 24px {border}.' };
    return { ok: true, value: text };
  }
  if (key === 'filter' || key === 'backdrop-filter') {
    if (!validFilter(text)) return { ok: false, message: 'Use a filter like blur(4px).' };
    return { ok: true, value: text };
  }
  if (key === 'clip-path') {
    if (!validClipPath(text)) return { ok: false, message: 'Use a shape like inset(0 0 10% 0).' };
    return { ok: true, value: text };
  }
  if (key === 'transition') {
    if (!validTransition(text)) return { ok: false, message: 'Use a transition like opacity 200ms ease.' };
    return { ok: true, value: text };
  }
  if (key === 'background') {
    if (!validColour(text) && !validUrlOrGradient(text)) return { ok: false, message: 'Use a colour, gradient, or none.' };
    return { ok: true, value: text };
  }
  if (key === 'border' || key === 'border-top' || key === 'border-right' || key === 'border-bottom' || key === 'border-left' || key === 'outline' || key === 'column-rule') {
    const parts = text.split(/\s+/);
    if (parts.length > 3) return { ok: false, message: 'Use width, style and colour.' };
    for (const part of parts) {
      if (!validColour(part) && !validLength(part) && !/^(none|solid|dashed|dotted|double|groove|ridge|inset|outset|thin|medium|thick)$/.test(part)) {
        return { ok: false, message: 'Use width, style and colour.' };
      }
    }
    return { ok: true, value: text };
  }
  if (KEYWORDS[key]) {
    if (!KEYWORDS[key].includes(text)) return { ok: false, message: 'Choose one of the listed values.' };
    return { ok: true, value: text };
  }
  if (LENGTH_PROPS.has(key)) {
    if (!validLength(text)) return { ok: false, message: 'Use a size like 16px, 1.5rem or auto.' };
    return { ok: true, value: resolveStyleValue(key, text) };
  }
  if (UNITLESS_PROPS.has(key)) {
    if (!NUMBER.test(text) && !/^(auto|none|inherit|initial|unset)$/.test(text)) {
      return { ok: false, message: 'Enter a number.' };
    }
    return { ok: true, value: text };
  }
  if (key === 'grid-template-columns' || key === 'grid-template-rows' || key === 'grid-auto-columns' || key === 'grid-auto-rows') {
    if (!/^[0-9a-z%.\s()_-]+$/i.test(text) || /url|expression/i.test(text)) return { ok: false, message: 'Use track sizes like 1fr 1fr.' };
    return { ok: true, value: text };
  }
  return { ok: true, value: text };
}

export function normalizeStyleSet(input: unknown): StyleValidation {
  const errors: { prop: string; message: string }[] = [];
  const styles: StyleSet = {};
  if (!input || typeof input !== 'object') return { ok: true, styles, errors };
  const set = input as Record<string, unknown>;
  let count = 0;
  for (const state of ['base', 'tablet', 'phone', 'hover', 'focus', 'active'] as const) {
    const declarations = set[state];
    if (!declarations || typeof declarations !== 'object') continue;
    const out: Declarations = {};
    for (const [rawProp, rawValue] of Object.entries(declarations as Record<string, unknown>)) {
      count += 1;
      if (count > MAX_STYLE_PROPERTIES) {
        errors.push({ prop: rawProp, message: 'Too many style changes on this element.' });
        return { ok: false, styles, errors };
      }
      const prop = rawProp.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).trim();
      if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
        errors.push({ prop, message: 'Enter a value.' });
        continue;
      }
      const result = validateStyleValue(prop, rawValue);
      if (!result.ok) {
        errors.push({ prop, message: result.message ?? 'This value is not allowed.' });
        continue;
      }
      if (result.value == null || result.value === '') continue;
      out[prop] = result.value;
    }
    if (Object.keys(out).length > 0) styles[state] = out;
  }
  return { ok: errors.length === 0, styles, errors };
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function canonical(declarations: Declarations): string {
  return Object.keys(declarations)
    .sort()
    .map((prop) => `${prop}:${declarations[prop]}`)
    .join(';');
}

function cssBlock(declarations: Declarations): string {
  return Object.keys(declarations)
    .sort()
    .map((prop) => `${prop}:${declarations[prop]}`)
    .join(';');
}

export function styleClass(prefix: string, declarations: Declarations): string {
  return `gs-${prefix}-${fnv1a(canonical(declarations))}`;
}

export function compileStyles(root: ContentNode, options: { customCss?: string } = {}): CompiledStyles {
  const rules = new Map<string, string>();
  const classes = new Map<string, string[]>();
  const fonts = new Set<string>();
  const baseRules: string[] = [];
  const tabletRules: string[] = [];
  const phoneRules: string[] = [];
  const stateRules: string[] = [];

  const add = (
    list: string[],
    prefix: string,
    declarations: Declarations | undefined,
    target: string[],
    selector?: string,
  ) => {
    if (!declarations || Object.keys(declarations).length === 0) return;
    const name = styleClass(prefix, declarations);
    if (!rules.has(name)) {
      const rule = `.${name}${selector ?? ''}{${cssBlock(declarations)}}`;
      rules.set(name, rule);
      target.push(rule);
    }
    if (!list.includes(name)) list.push(name);
    const family = declarations['font-family'];
    if (typeof family === 'string' && !/^var\(--s-font-(?:heading|body)\)$/.test(family) && !/^(inherit|initial|unset)$/.test(family)) {
      const nameMatch = family.replace(/^['"]|['"]$/g, '').split(',')[0]?.trim();
      if (nameMatch) fonts.add(nameMatch);
    }
  };

  walkNodes(root, (node) => {
    if (node.type === 'reference') return;
    const normalized = normalizeStyleSet(node.styles);
    if (!normalized.ok) return;
    const styles = normalized.styles;
    const list: string[] = [];
    add(list, 's', styles.base, baseRules);
    add(list, 'h', styles.hover, stateRules, ':hover');
    add(list, 'f', styles.focus, stateRules, ':focus-visible');
    add(list, 'a', styles.active, stateRules, ':active');
    add(list, 't', styles.tablet, tabletRules);
    add(list, 'p', styles.phone, phoneRules);
    if (list.length > 0) classes.set(node.id, list);
  });

  const body = [
    ...baseRules,
    ...stateRules,
    ...(tabletRules.length ? [`@container site (max-width:899px){${tabletRules.join('')}}`] : []),
    ...(phoneRules.length ? [`@container site (max-width:639px){${phoneRules.join('')}}`] : []),
  ].join('');

  const custom = options.customCss ? sanitizeCustomCss(options.customCss).css : '';
  const css = `@layer gs-protect, gs-base, gs-theme, gs-nodes, gs-user;@layer gs-nodes{${body}}${custom ? `@layer gs-user{${custom}}` : ''}`;
  return {
    css,
    classes,
    bytes: new TextEncoder().encode(css).length,
    fonts: [...fonts],
    hash: fnv1a(css),
  };
}

export function styleClassesFor(compiled: CompiledStyles, nodeId: string): string[] {
  return compiled.classes.get(nodeId) ?? [];
}

export function collectNodeClasses(root: ContentNode): string[] {
  const set = new Set<string>();
  walkNodes(root, (node) => {
    for (const cls of node.classes ?? []) set.add(cls);
  });
  return [...set];
}
