import { customAlphabet } from 'nanoid';
import type { ContentNode, NodePath, NodeType, PageContentV5 } from './types';
import { MAX_ID_LENGTH } from './limits';
import { createBlock, normalizeBlock } from '../utils';

const newId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

const CONTAINERS: NodeType[] = [
  'page',
  'section',
  'container',
  'stack',
  'columns',
  'column',
  'grid',
  'accordion',
  'accordion-item',
];

const LEAVES: NodeType[] = [
  'heading',
  'text',
  'list',
  'image',
  'button',
  'divider',
  'spacer',
  'video',
  'icon',
  'form',
  'html',
  'field',
  'smart',
  'reference',
];

export const NODE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

export function isValidNodeId(value: unknown): value is string {
  return typeof value === 'string' && NODE_ID_PATTERN.test(value);
}

export function makeNodeId(): string {
  return `n_${newId()}`;
}

const CONTAINER_SET = new Set<string>(CONTAINERS);
const LEAF_SET = new Set<string>(LEAVES);

export function isContainerType(type: NodeType): boolean {
  return CONTAINER_SET.has(type);
}

export function isLeafType(type: NodeType): boolean {
  return LEAF_SET.has(type);
}

export function canHaveChildren(node: ContentNode): boolean {
  if (node.locked) return false;
  if (!isContainerType(node.type)) return false;
  if (node.type === 'columns') return true;
  return true;
}

export function acceptsChild(parent: ContentNode, child: ContentNode): boolean {
  const parentType: string = parent.type;
  const childType: string = child.type;
  if (parent.locked) return false;
  if (!CONTAINER_SET.has(parentType)) return false;
  if (parentType === 'columns') return childType === 'column';
  if (parentType === 'accordion') return childType === 'accordion-item';
  if (childType === 'column') return parentType === 'columns';
  if (childType === 'accordion-item') return parentType === 'accordion';
  return true;
}

export function createNode(type: NodeType, props: Record<string, unknown> = {}): ContentNode {
  const base: ContentNode = { id: makeNodeId(), type, props };
  switch (type) {
    case 'page':
      return { ...base, id: 'page', props: {}, children: [] };
    case 'section':
      return { ...base, children: [], props: { name: 'Section', ...props } };
    case 'container':
    case 'stack':
    case 'grid':
      return { ...base, children: [], props };
    case 'columns':
      return { ...base, children: [], props: { gap: 'medium', ...props } };
    case 'column':
      return { ...base, children: [], props };
    case 'heading':
      return { ...base, props: { text: 'Your heading', level: 'h2', ...props } };
    case 'text':
      return { ...base, props: { text: 'Write something here.', ...props } };
    case 'list':
      return { ...base, props: { items: ['First item', 'Second item'], ordered: false, ...props } };
    case 'image':
      return { ...base, props: { imageId: null, alt: '', ...props } };
    case 'button':
      return { ...base, props: { label: 'Learn more', link: { type: 'none' }, style: 'solid', ...props } };
    case 'divider':
      return { ...base, props: { style: 'line', ...props } };
    case 'spacer':
      return { ...base, props: { height: 'medium', ...props } };
    case 'video':
      return { ...base, props: { url: '', posterId: null, ...props } };
    case 'icon':
      return { ...base, props: { name: 'star', ...props } };
    case 'accordion':
      return { ...base, children: [], props };
    case 'accordion-item':
      return { ...base, children: [], props: { title: 'Question', open: false, ...props } };
    case 'form':
      return { ...base, props: { kind: 'contact', ...props } };
    case 'html':
      return { ...base, props: { html: '', ...props } };
    case 'field':
      return { ...base, props: { key: 'business.name', ...props } };
    case 'smart':
      return { ...base, props };
    case 'reference':
      return { ...base, props: { patternId: '', ...props } };
    default:
      return base;
  }
}

export function smartNodeFromBlock(block: any): ContentNode {
  const normalized = normalizeBlock(block);
  const { id, type, props, sec, includeIf, slotMeta, sampleOnly } = normalized;
  const nodeId = sanitizeNodeId(id) ?? makeNodeId();
  if (type === 'shared' && props?.sharedId) {
    return { id: nodeId, type: 'reference', props: { patternId: props.sharedId } };
  }
  return {
    id: nodeId,
    type: 'smart',
    props: {
      kind: type,
      ...(props ?? {}),
      ...(sec ? { sec } : {}),
      ...(includeIf ? { includeIf } : {}),
      ...(slotMeta ? { slotMeta } : {}),
    },
    ...(sampleOnly ? { sampleOnly: true } : {}),
  };
}

export function sanitizeNodeId(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let value = raw.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, MAX_ID_LENGTH);
  if (!/^[A-Za-z]/.test(value)) value = `n-${value}`.slice(0, MAX_ID_LENGTH);
  return value;
}

export function walkNodes(root: ContentNode, visit: (node: ContentNode, path: NodePath) => void, path: NodePath = []): void {
  visit(root, path);
  const children = root.children ?? [];
  for (let i = 0; i < children.length; i++) {
    walkNodes(children[i], visit, [...path, i]);
  }
}

export function mapNodes(root: ContentNode, fn: (node: ContentNode, path: NodePath) => ContentNode, path: NodePath = []): ContentNode {
  const next = fn(root, path);
  if (!next.children) return next;
  return {
    ...next,
    children: next.children.map((child, index) => mapNodes(child, fn, [...path, index])),
  };
}

export function countNodes(root: ContentNode): number {
  let count = 0;
  walkNodes(root, () => {
    count += 1;
  });
  return count;
}

export function treeDepth(root: ContentNode): number {
  let max = 0;
  walkNodes(root, (_node, path) => {
    max = Math.max(max, path.length);
  });
  return max;
}

export function getNodeAtPath(root: ContentNode, path: NodePath): ContentNode | null {
  let node: ContentNode | undefined = root;
  for (const index of path) {
    node = node?.children?.[index];
    if (!node) return null;
  }
  return node ?? null;
}

export function findNode(root: ContentNode, id: string): ContentNode | null {
  let found: ContentNode | null = null;
  walkNodes(root, (node) => {
    if (!found && node.id === id) found = node;
  });
  return found;
}

export function findNodePath(root: ContentNode, id: string): NodePath | null {
  let found: NodePath | null = null;
  walkNodes(root, (node, path) => {
    if (!found && node.id === id) found = path;
  });
  return found;
}

export function findParent(root: ContentNode, id: string): { parent: ContentNode; index: number; path: NodePath } | null {
  let result: { parent: ContentNode; index: number; path: NodePath } | null = null;
  walkNodes(root, (node, path) => {
    if (result) return;
    const index = (node.children ?? []).findIndex((child) => child.id === id);
    if (index >= 0) result = { parent: node, index, path };
  });
  return result;
}

export function replaceNode(root: ContentNode, id: string, replacement: ContentNode): ContentNode {
  if (root.id === id) return replacement;
  if (!root.children) return root;
  return {
    ...root,
    children: root.children.map((child) => replaceNode(child, id, replacement)),
  };
}

export function removeNode(root: ContentNode, id: string): ContentNode {
  if (root.id === id) return root;
  if (!root.children) return root;
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) => removeNode(child, id)),
  };
}

export function insertNode(
  root: ContentNode,
  parentId: string,
  node: ContentNode,
  index?: number,
): ContentNode {
  const parent = findNode(root, parentId);
  if (!parent) return root;
  const children = [...(parent.children ?? [])];
  const at = index == null ? children.length : Math.max(0, Math.min(index, children.length));
  children.splice(at, 0, node);
  return replaceNode(root, parentId, { ...parent, children });
}

export function moveNode(root: ContentNode, id: string, parentId: string, index?: number): ContentNode {
  const node = findNode(root, id);
  if (!node) return root;
  const target = findNode(root, parentId);
  if (!target) return root;
  if (id === parentId) return root;
  if (containsNode(node, parentId)) return root;
  if (!acceptsChild(target, node)) return root;
  const without = removeNode(root, id);
  return insertNode(without, parentId, node, index);
}

export function containsNode(root: ContentNode, id: string): boolean {
  if (root.id === id) return true;
  return (root.children ?? []).some((child) => containsNode(child, id));
}

export function cloneNode(node: ContentNode, freshIds = true): ContentNode {
  const copy: ContentNode = {
    ...node,
    id: freshIds ? makeNodeId() : node.id,
    props: node.props ? structuredClone(node.props) : undefined,
    styles: node.styles ? structuredClone(node.styles) : undefined,
    attrs: node.attrs ? structuredClone(node.attrs) : undefined,
  };
  if (node.children) copy.children = node.children.map((child) => cloneNode(child, freshIds));
  return copy;
}

export function duplicateNode(root: ContentNode, id: string): ContentNode {
  const found = findParent(root, id);
  if (!found) return root;
  const node = found.parent.children?.[found.index];
  if (!node) return root;
  const copy = cloneNode(node);
  const children = [...(found.parent.children ?? [])];
  children.splice(found.index + 1, 0, copy);
  return replaceNode(root, found.parent.id, { ...found.parent, children });
}

export function collectFields(root: ContentNode): { nodeId: string; key: string; fallback?: string }[] {
  const fields: { nodeId: string; key: string; fallback?: string }[] = [];
  walkNodes(root, (node) => {
    if (node.type === 'field' && typeof node.props?.key === 'string') {
      fields.push({ nodeId: node.id, key: node.props.key, fallback: typeof node.props.fallback === 'string' ? node.props.fallback : undefined });
    }
  });
  return fields;
}

export function collectV5MediaIds(root: ContentNode): string[] {
  const ids = new Set<string>();
  walkNodes(root, (node) => {
    if (node.type === 'smart') {
      for (const id of collectSmartMedia(node.props ?? {})) ids.add(id);
      return;
    }
    for (const key of ['imageId', 'posterId', 'beforeId', 'afterId', 'fileId']) {
      const value = node.props?.[key];
      if (typeof value === 'string' && value.length > 0) ids.add(value);
    }
    const items = node.props?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === 'object' && typeof (item as any).imageId === 'string') ids.add((item as any).imageId);
      }
    }
  });
  return [...ids];
}

function collectSmartMedia(value: any, key?: string, into: Set<string> = new Set()): Set<string> {
  if (value == null) return into;
  if (typeof value === 'string' && (key === 'imageId' || key === 'beforeId' || key === 'afterId' || key === 'posterId' || key === 'photoId' || key === 'fileId')) {
    into.add(value);
    return into;
  }
  if (Array.isArray(value)) value.forEach((item) => collectSmartMedia(item, undefined, into));
  else if (typeof value === 'object') Object.entries(value).forEach(([k, v]) => collectSmartMedia(v, k, into));
  return into;
}

export function collectAnchorsV5(root: ContentNode): string[] {
  const anchors: string[] = [];
  walkNodes(root, (node) => {
    const id = node.attrs?.id;
    if (id) anchors.push(id);
    const secAnchor = node.type === 'smart' ? (node.props as any)?.sec?.anchor : null;
    if (typeof secAnchor === 'string' && secAnchor.length > 0) anchors.push(secAnchor);
  });
  return anchors;
}

export function countSampleNodes(root: ContentNode): number {
  let count = 0;
  walkNodes(root, (node) => {
    if (node.sampleOnly) count += 1;
  });
  return count;
}

export function countHtmlNodes(root: ContentNode): number {
  let count = 0;
  walkNodes(root, (node) => {
    if (node.type === 'html') count += 1;
  });
  return count;
}

export function emptyPage(): PageContentV5 {
  return {
    schemaVersion: 5,
    root: { id: 'page', type: 'page', props: {}, children: [] },
  };
}

export function pageFromBlocks(blocks: any[]): PageContentV5 {
  return {
    schemaVersion: 5,
    root: {
      id: 'page',
      type: 'page',
      props: {},
      children: blocks.map(smartNodeFromBlock),
    },
  };
}

export function smartBlockFromNode(node: ContentNode): any {
  const props = { ...(node.props ?? {}) };
  const kind = String(props.kind ?? 'text');
  delete props.kind;
  const includeIf = props.includeIf;
  const slotMeta = props.slotMeta;
  const sec = props.sec;
  delete props.includeIf;
  delete props.slotMeta;
  return {
    id: node.id,
    type: kind,
    props,
    ...(sec ? { sec } : {}),
    ...(includeIf ? { includeIf } : {}),
    ...(slotMeta ? { slotMeta } : {}),
    ...(node.sampleOnly ? { sampleOnly: true } : {}),
  };
}

export function defaultSmartProps(kind: string): Record<string, unknown> {
  const block = createBlock(kind);
  return { kind, ...(block.props ?? {}), ...(block.sec ? { sec: block.sec } : {}) };
}
