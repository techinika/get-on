import type { LinkTarget } from '../types';

export const NODE_TYPES = [
  'page',
  'section',
  'container',
  'stack',
  'columns',
  'column',
  'grid',
  'heading',
  'text',
  'list',
  'image',
  'button',
  'divider',
  'spacer',
  'video',
  'icon',
  'accordion',
  'accordion-item',
  'form',
  'html',
  'field',
  'smart',
  'reference',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export type NodeId = string;

export type Device = 'computer' | 'tablet' | 'phone';

export type StyleValue = string | number;

export type Declarations = Record<string, StyleValue>;

export type StyleSet = {
  base?: Declarations;
  tablet?: Declarations;
  phone?: Declarations;
  hover?: Declarations;
  focus?: Declarations;
  active?: Declarations;
};

export type NodeAttrs = {
  id?: string;
  role?: string;
  ariaLabel?: string;
  ariaHidden?: boolean;
  data?: Record<string, string>;
};

export type Hidden = {
  all?: boolean;
  computer?: boolean;
  tablet?: boolean;
  phone?: boolean;
};

export type FieldKey =
  | 'business.name'
  | 'business.tagline'
  | 'business.description'
  | 'business.type'
  | 'contact.phone'
  | 'contact.email'
  | 'contact.address'
  | 'contact.whatsapp'
  | 'contact.hours'
  | 'contact.mapUrl'
  | 'page.title';

export type FieldProps = {
  key: FieldKey;
  fallback?: string;
  format?: 'text' | 'phone' | 'address' | 'hours' | 'link';
};

export type ReferenceProps = {
  patternId: string;
  overrides?: Record<string, Partial<Pick<ContentNode, 'props' | 'styles' | 'hidden'>>>;
};

export type SmartProps = {
  kind: string;
  [key: string]: unknown;
};

export type ContentNode = {
  id: NodeId;
  type: NodeType;
  props?: Record<string, unknown>;
  styles?: StyleSet;
  classes?: string[];
  attrs?: NodeAttrs;
  locked?: boolean;
  hidden?: Hidden;
  note?: string;
  requiresPlugin?: string;
  sampleOnly?: boolean;
  children?: ContentNode[];
};

export type PageMeta = {
  title?: string;
  description?: string;
  editorVersion?: number;
  migratedFrom?: number;
  migratedAt?: string;
};

export type PageContentV5 = {
  schemaVersion: 5;
  root: ContentNode;
  css?: string;
  meta?: PageMeta;
};

export type NodePath = number[];

export type TreeIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; content: PageContentV5; warnings: TreeIssue[] }
  | { ok: false; errors: TreeIssue[] };

export type CompiledStyles = {
  css: string;
  classes: Map<string, string[]>;
  bytes: number;
  fonts: string[];
  hash: string;
};

export type PatternRecord = {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  content: ContentNode;
  source: 'system' | 'team';
  teamId?: string | null;
  createdAt?: string;
};

export type LinkValue = LinkTarget;
