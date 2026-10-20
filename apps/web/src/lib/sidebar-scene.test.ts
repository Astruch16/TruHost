import { describe, expect, it } from 'vitest';
import { buildSidebarScene, pine, ridge, snowCap } from './sidebar-scene';

describe('sidebar scene', () => {
  it('is the same on every build (seeded), so it never shifts between renders', () => {
    expect(buildSidebarScene()).toEqual(buildSidebarScene());
  });

  it('keeps the stars clear of the moon, and puts snow on the high peaks of both ranges', () => {
    const s = buildSidebarScene();
    expect(s.stars.length).toBeGreaterThan(12);
    for (const star of s.stars) expect(Math.hypot(star.x - 200, star.y - 86)).toBeGreaterThan(20);
    expect(s.farSnow.length).toBeGreaterThanOrEqual(2);
    expect(s.midSnow.length).toBeGreaterThanOrEqual(1);
    expect(s.farLit.length).toBeGreaterThanOrEqual(3);
  });

  it('draws ridges as curves down to the ground, not ruled lines', () => {
    const d = ridge(
      [
        [0, 100],
        [50, 40],
        [100, 90],
      ],
      150,
      1,
    );
    expect(d.startsWith('M0 150 L0 100')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(6);
    expect(d.endsWith('L100 150 Z')).toBe(true);
  });

  it('gives each pine tier a moonlit edge, and a snow cap a lit half', () => {
    const p = pine(50, 100, 40, 20, 4);
    expect(p.d.match(/Z/g)).toHaveLength(5); // trunk and four tiers
    expect(p.lit.match(/Z/g)).toHaveLength(4);
    const cap = snowCap([50, 40], [20, 100], [80, 100], 12, 3);
    expect(cap.cap.startsWith('M')).toBe(true);
    expect(cap.lit).toContain('M50 40');
  });
});
