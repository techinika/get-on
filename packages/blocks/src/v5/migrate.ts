import { migrateContent } from '../utils';
import { PLUGIN_MANIFESTS } from '@get-on/plugins';
import type { ContentNode, PageContentV5 } from './types';
import { emptyPage, makeNodeId, sanitizeNodeId, smartNodeFromBlock } from './tree';

const PLUGIN_BLOCKS = new Map<string, string>();
for (const manifest of PLUGIN_MANIFESTS) {
  for (const block of manifest.blocks) PLUGIN_BLOCKS.set(block, manifest.id);
}

export function isPageContentV5(raw: unknown): raw is PageContentV5 {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      (raw as any).schemaVersion === 5 &&
      (raw as any).root &&
      typeof (raw as any).root === 'object' &&
      (raw as any).root.type === 'page',
  );
}

export function migrateV4ToV5(raw: unknown): PageContentV5 {
  if (isPageContentV5(raw)) return raw;
  const migrated = migrateContent(raw);
  const usedIds = new Set<string>(['page']);
  const usedAnchors = new Set<string>();

  const children: ContentNode[] = migrated.blocks.map((block: any) => {
    const node = smartNodeFromBlock(block);
    let id = sanitizeNodeId(node.id) ?? makeNodeId();
    while (usedIds.has(id)) id = makeNodeId();
    usedIds.add(id);
    node.id = id;

    const sec = node.type === 'smart' ? (node.props as any)?.sec : null;
    if (sec) {
      if (sec.hidden === true) node.hidden = { all: true };
      if (Array.isArray(sec.hideOn) && sec.hideOn.length > 0) {
        node.hidden = {
          ...(node.hidden ?? {}),
          ...(sec.hideOn.includes('computer') ? { computer: true } : {}),
          ...(sec.hideOn.includes('tablet') ? { tablet: true } : {}),
          ...(sec.hideOn.includes('phone') ? { phone: true } : {}),
        };
      }
      if (typeof sec.anchor === 'string' && sec.anchor.length > 0) {
        let anchor = sec.anchor;
        let n = 2;
        while (usedAnchors.has(anchor)) anchor = `${sec.anchor}-${n++}`;
        usedAnchors.add(anchor);
        if (anchor !== sec.anchor) (node.props as any).sec = { ...sec, anchor };
        node.attrs = { ...(node.attrs ?? {}), id: anchor };
      }
    }

    const plugin = PLUGIN_BLOCKS.get(String((node.props as any)?.kind ?? ''));
    if (plugin) node.requiresPlugin = plugin;
    return node;
  });

  return {
    ...emptyPage(),
    root: { id: 'page', type: 'page', props: {}, children },
    meta: {
      editorVersion: 1,
      migratedFrom: 4,
      migratedAt: new Date().toISOString(),
    },
  };
}

export function v5ToV4Blocks(content: PageContentV5): any[] {
  const children = content.root.children ?? [];
  return children.map((node) => {
    if (node.type === 'reference') {
      return {
        id: node.id,
        type: 'shared',
        props: { sharedId: String(node.props?.patternId ?? '') },
      };
    }
    if (node.type !== 'smart') {
      return {
        id: node.id,
        type: 'text',
        props: { text: 'This section uses the new editor and cannot be shown in the old editor.' },
      };
    }
    const props = { ...(node.props ?? {}) };
    const kind = String(props.kind ?? 'text');
    delete props.kind;
    return { id: node.id, type: kind, props };
  });
}
