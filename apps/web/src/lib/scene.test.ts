import { describe, expect, it } from 'vitest';
import { buildScene, pinePath, pineRow, seeded } from './scene';

describe('scene generator', () => {
  it('is deterministic for a seed', () => {
    const a = seeded(1);
    const b = seeded(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(pineRow({ seed: 3, baseY: 100, minHeight: 10, maxHeight: 20, spacing: 10 })).toBe(
      pineRow({ seed: 3, baseY: 100, minHeight: 10, maxHeight: 20, spacing: 10 }),
    );
  });

  it('draws a closed pine whose apex is at the requested height', () => {
    const d = pinePath(50, 100, 40, 20);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain('50,60');
  });
});

describe('buildScene', () => {
  it('fills the requested width', () => {
    const wide = buildScene(600);
    expect(wide.backRange).toContain('600,330');
    expect(wide.ground).toContain('L600,330');
    expect(buildScene()).toEqual(buildScene(250));
  });
});
