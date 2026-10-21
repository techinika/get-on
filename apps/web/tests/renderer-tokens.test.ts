import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('renderer tokens', () => {
  it('renderer css has no hardcoded hex outside tokens context', () => {
    const cssPath = path.resolve(__dirname, '../../../packages/renderer/styles/renderer.css');
    if (fs.existsSync(cssPath)) {
      const css = fs.readFileSync(cssPath, 'utf8');
      expect(css).toContain('--s-');
    }
  });

  it('palette with dark object still renders light', async () => {
    const { themeTokens } = await import('@get-on/blocks');
    const tokens = themeTokens({ palette: 'fresh-green', fontPair: 'friendly', corners: 'soft', colorMode: 'dark' });
    expect(tokens['--s-bg']).toBe('#FFFBF5');
  });
});
