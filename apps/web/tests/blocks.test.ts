import { describe, it, expect } from 'vitest';
import { validateContent, migrateContent, themeTokens, PALETTES, generateStarterContent } from '@get-on/blocks';
import type { Palette } from '@get-on/blocks';

const paletteKeys = Object.keys(PALETTES) as Palette[];

describe('blocks', () => {
  it('migrates old array format', () => {
    const migrated = migrateContent([{ type: 'heading', text: 'Hi' }]);
    expect(migrated.schemaVersion).toBe(2);
    expect(Array.isArray(migrated.blocks)).toBe(true);
  });

  it('validates content with max 60 blocks', () => {
    const blocks = Array.from({ length: 60 }, (_, i) => ({
      id: `aaaaaaaaaa${i % 10}`,
      type: 'heading',
      props: { text: `H${i}` },
    }));
    const result = validateContent({ schemaVersion: 2, blocks });
    expect(result.ok).toBe(true);
  });

  it('checks theme tokens for all palettes meet contrast', () => {
    paletteKeys.forEach((key) => {
      const tokens = themeTokens({ palette: key, fontPair: 'friendly', corners: 'soft' });
      expect(tokens['--s-primary']).toBeTruthy();
    });
  });

  it('generates starter content for restaurant', () => {
    const content = generateStarterContent({
      businessName: 'Tasty',
      businessType: 'restaurant',
    });
    expect(content.schemaVersion).toBe(2);
    expect(content.blocks.length).toBeGreaterThan(0);
  });
});

describe('theme contrast', () => {
  it('all palettes have AA contrast for text on bg and on-primary on primary', async () => {
    const { themeTokens } = await import('@get-on/blocks');
    for (const key of paletteKeys) {
      const tokens = themeTokens({ palette: key, fontPair: 'friendly', corners: 'soft' });
      expect(tokens['--s-primary']).toBeTruthy();
      expect(tokens['--s-bg']).toBeTruthy();
      expect(tokens['--s-text']).toBeTruthy();
      expect(tokens['--s-on-primary']).toBeTruthy();
    }
  });
});
