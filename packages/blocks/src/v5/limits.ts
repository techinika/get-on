export const EDITOR_SCHEMA_VERSION = 5 as const;

export const MAX_NODES = 2000;
export const MAX_DEPTH = 12;
export const MAX_DOCUMENT_BYTES = 1024 * 1024;
export const MAX_NODE_TEXT = 20_000;
export const MAX_CLASSES = 10;
export const MAX_DATA_ATTRS = 10;
export const MAX_HTML_NODES = 10;
export const MAX_STYLE_PROPERTIES = 60;
export const MAX_CUSTOM_CSS_BYTES = 120 * 1024;
export const CSS_BUDGET_SOFT_BYTES = 40 * 1024;
export const CSS_BUDGET_HARD_BYTES = 120 * 1024;

export const MAX_ID_LENGTH = 40;
export const MAX_NOTE_LENGTH = 500;
export const MAX_PATTERN_DEPTH = 6;

export type CustomCodeLimits = {
  cssKb: number;
  htmlNodes: number;
  patterns: number;
};

export const CUSTOM_CODE_LIMITS: Record<'free' | 'basic' | 'pro' | 'enterprise', CustomCodeLimits> = {
  free: { cssKb: 10, htmlNodes: 3, patterns: 20 },
  basic: { cssKb: 30, htmlNodes: 10, patterns: 100 },
  pro: { cssKb: 50, htmlNodes: 10, patterns: 300 },
  enterprise: { cssKb: 100, htmlNodes: 10, patterns: 1000 },
};

export function customCodeLimits(plan: string | null | undefined): CustomCodeLimits {
  const key = (plan ?? 'free').toLowerCase();
  if (key === 'basic' || key === 'pro' || key === 'enterprise') return CUSTOM_CODE_LIMITS[key];
  return CUSTOM_CODE_LIMITS.free;
}
