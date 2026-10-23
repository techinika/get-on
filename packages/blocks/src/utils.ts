import { customAlphabet } from 'nanoid';
import { pageContentSchema, blockSchema } from './schemas';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 10);

export function createBlock(type: string, overrides?: any) {
  const base: any = { type, props: {} };
  const parsed = blockSchema.safeParse(base);
  if (parsed.success) {
    return { id: nanoid(), ...parsed.data, ...(overrides ?? {}) };
  }
  return { id: nanoid(), type, props: {}, ...(overrides ?? {}) };
}

export function migrateContent(raw: any): any {
  if (raw == null) {
    return { schemaVersion: 2 as const, blocks: [] };
  }
  if (Array.isArray(raw)) {
    const blocks = raw.map((b: any) => {
      if (b && typeof b === 'object') {
        return { id: b.id || nanoid(), type: b.type || 'text', props: b.props || {} };
      }
      return createBlock('text');
    });
    return { schemaVersion: 2 as const, blocks };
  }
  if (typeof raw === 'object' && raw.schemaVersion === 2 && Array.isArray(raw.blocks)) {
    return raw;
  }
  return { schemaVersion: 2 as const, blocks: [] };
}

export function validateContent(raw: any): { ok: boolean; content?: any; issues?: any[] } {
  const migrated = migrateContent(raw);
  const parsed = pageContentSchema.safeParse(migrated);
  if (parsed.success) {
    return { ok: true, content: parsed.data };
  }
  return { ok: false, content: migrated, issues: parsed.error.issues };
}

export function countBlocks(content: any): number {
  if (!content) return 0;
  if (Array.isArray(content)) return content.length;
  if (Array.isArray(content.blocks)) return content.blocks.length;
  return 0;
}
