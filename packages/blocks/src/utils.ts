import { customAlphabet } from 'nanoid';
import { pageContentSchema, blockSchema, type SectionOptions } from './schemas';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 10);

export function createBlock(type: string, overrides?: any) {
  const parsed = blockSchema.safeParse({ type, props: {} });
  if (parsed.success) {
    return { id: nanoid(), ...parsed.data, ...(overrides ?? {}) };
  }
  return { id: nanoid(), type, props: {}, ...(overrides ?? {}) };
}

export function createId(): string {
  return nanoid();
}

function oldBackground(value: unknown): SectionOptions['bg']['type'] {
  return value === 'soft' || value === 'brand' ? value : 'plain';
}

function withSection(block: any): any {
  if (!block || typeof block !== 'object') return block;
  const props = block.props ?? {};
  if (block.type === 'shared') return block;
  const sec = block.sec ?? {};
  const bg = sec.bg ?? {};
  const bgType = bg.type && bg.type !== 'plain' ? bg.type : oldBackground(props.background);
  return {
    ...block,
    sec: {
      bg: { ...bg, type: bgType },
      spaceTop: sec.spaceTop ?? 'normal',
      spaceBottom: sec.spaceBottom ?? 'normal',
      width: sec.width ?? 'normal',
      anchor: sec.anchor ?? '',
      menuLabel: sec.menuLabel ?? '',
      hideOn: sec.hideOn ?? [],
      hidden: sec.hidden ?? false,
    },
  };
}

export function normalizeBlock(raw: any): any {
  if (!raw || typeof raw !== 'object') return createBlock('text');
  let block: any = { id: raw.id || nanoid(), type: raw.type || 'text', props: raw.props || {}, ...(raw.sec ? { sec: raw.sec } : {}) };

  if (block.type === 'contact-cta') {
    block = { ...block, type: 'cta' };
  }
  if (block.type === 'gallery' && Array.isArray(block.props.imageIds)) {
    block = {
      ...block,
      props: {
        ...block.props,
        items: block.props.imageIds.map((imageId: string) => ({ imageId, caption: '' })),
      },
    };
    delete block.props.imageIds;
  }
  if (block.type === 'contact-form') {
    const props = block.props || {};
    block = {
      ...block,
      props: {
        ...props,
        variation: props.variation ?? 'classic',
        intro: props.intro ?? 'Fill in the form and we will get back to you.',
        showName: props.showName ?? true,
        showPhone: props.showPhone ?? false,
        phoneRequired: props.phoneRequired ?? false,
        submitLabel: props.submitLabel ?? 'Send message',
        consentText: props.consentText ?? 'We will only use your details to reply to your message.',
        hoursNote: props.hoursNote ?? props.hours ?? '',
      },
    };
  }
  return withSection(block);
}

export function migrateContent(raw: any): { schemaVersion: 4; blocks: any[] } {
  if (raw == null) return { schemaVersion: 4, blocks: [] };
  if (Array.isArray(raw)) return { schemaVersion: 4, blocks: raw.map(normalizeBlock) };
  if (typeof raw === 'object' && Array.isArray(raw.blocks)) {
    return { schemaVersion: 4, blocks: raw.blocks.map(normalizeBlock) };
  }
  return { schemaVersion: 4, blocks: [] };
}

export function validateContent(raw: any): { ok: boolean; content?: any; issues?: any[] } {
  const migrated = migrateContent(raw);
  const parsed = pageContentSchema.safeParse(migrated);
  if (parsed.success) return { ok: true, content: parsed.data };
  return { ok: false, content: migrated, issues: parsed.error.issues };
}

export function countBlocks(content: any): number {
  if (!content) return 0;
  if (Array.isArray(content)) return content.length;
  if (Array.isArray(content.blocks)) return content.blocks.length;
  return 0;
}

const LABELS: Record<string, string> = {
  hero: 'Hero', heading: 'Heading', text: 'Text', 'image-text': 'Picture with text',
  image: 'Picture', gallery: 'Gallery', video: 'Video', 'before-after': 'Before and after',
  features: 'Features', services: 'Services and prices', products: 'Products', menu: 'Menu',
  pricing: 'Pricing plans', projects: 'Projects', testimonials: 'Testimonials', team: 'Team',
  stats: 'Numbers', logos: 'Logos', steps: 'How it works', faq: 'Questions', quote: 'Quote',
  'opening-hours': 'Opening hours', map: 'Map and directions', 'contact-details': 'Contact details',
  'contact-form': 'Contact form', 'quick-contact': 'Contact buttons', 'social-links': 'Social links',
  cta: 'Call to action', 'link-list': 'Link list', button: 'Button', downloads: 'Downloads',
  spacer: 'Space', divider: 'Line', shared: 'Shared section',
};

export function blockLabel(type: string): string {
  return LABELS[type] ?? 'Section';
}

export function blockSummary(block: any): string {
  const props = block?.props ?? {};
  if (block?.type === 'shared') return 'Shared section';
  const value =
    props.heading ?? props.title ?? props.text ?? props.label ?? props.name ?? props.eyebrow ?? '';
  const plain = typeof value === 'string' ? value : '';
  return plain ? plain.slice(0, 60) : blockLabel(block?.type ?? '');
}

export function collectMediaIds(content: any): string[] {
  const ids = new Set<string>();
  const visit = (value: any, key?: string) => {
    if (value == null) return;
    if (typeof value === 'string' && (key === 'imageId' || key === 'beforeId' || key === 'afterId' || key === 'posterId' || key === 'photoId' || key === 'fileId')) {
      ids.add(value);
      return;
    }
    if (Array.isArray(value)) value.forEach((item) => visit(item));
    else if (typeof value === 'object') Object.entries(value).forEach(([k, v]) => visit(v, k));
  };
  visit(content?.blocks ?? content);
  return [...ids];
}

export function collectAnchors(blocks: any[]): string[] {
  return blocks.map((b) => b?.sec?.anchor).filter((a): a is string => typeof a === 'string' && a.length > 0);
}

export function ensureUniqueAnchors(blocks: any[]): any[] {
  const seen = new Set<string>();
  return blocks.map((block) => {
    const anchor = block?.sec?.anchor;
    if (!anchor) return block;
    let next = anchor;
    let n = 2;
    while (seen.has(next)) next = `${anchor}-${n++}`;
    seen.add(next);
    return next === anchor ? block : { ...block, sec: { ...block.sec, anchor: next } };
  });
}

export function suggestAnchor(block: any): string {
  const raw = String(block?.props?.heading ?? block?.props?.title ?? block?.props?.text ?? block?.props?.label ?? '');
  const slug = raw.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  return /^[a-z]/.test(slug) ? slug : `section-${Math.max(1, Number(block?.id?.length ?? 1))}`;
}

export function blocksNeedingH1(blocks: any[]): any[] {
  return blocks.filter((b) => {
    if (b?.type === 'hero') return true;
    return b?.type === 'heading' && b?.props?.level === 'h1';
  });
}
