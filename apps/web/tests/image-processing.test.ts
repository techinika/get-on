import { describe, it, expect } from 'vitest';

describe('image processing', () => {
  it('has processImageForUpload function', async () => {
    const mod = await import('@/lib/images/process');
    expect(typeof mod.processImageForUpload).toBe('function');
  });
});
