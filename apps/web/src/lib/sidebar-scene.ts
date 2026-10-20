/**
 * The sidebar's night scene, in the style of the sign-in page (docs/design/Login.dc.html): two mountain ranges with
 * sagging slopes, a moonlit face and a shadowed one, and ragged snow caps; pines with curved tiers and moonlit edges;
 * a lake, a cabin and a path. Drawn on a 250 × 330 board, anchored to the bottom. Pure and seeded, so it's the same on
 * every render and in tests.
 */

export const SCENE_WIDTH = 250;
export const SCENE_HEIGHT = 330;

type Pt = readonly [number, number];

/** Small deterministic PRNG (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;
const pt = ([x, y]: Pt) => `${f(x)} ${f(y)}`;

/**
 * A ridgeline through `points` (peaks and saddles), closed down to `bottom`. Each slope sags a little, as real
 * mountain flanks do, and gets a few small seeded steps so it never reads as a ruled line.
 */
export function ridge(points: readonly Pt[], bottom: number, seed: number, sag = 0.14): string {
  const rand = seeded(seed);
  let d = `M${pt([points[0]![0], bottom])} L${pt(points[0]!)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    const steps = 3;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      // A step along the slope, nudged up or down a touch (not at the ends, so peaks stay sharp).
      const jitter = s < steps ? (rand() - 0.5) * 2.2 : 0;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t + jitter;
      const px = x0 + (x1 - x0) * (t - 1 / steps);
      const py = y0 + (y1 - y0) * (t - 1 / steps);
      // The control point drops below the straight line: a concave, sagging flank.
      const cx = (px + x) / 2;
      const cy = (py + y) / 2 + Math.abs(x1 - x0) * sag * (1 / steps);
      d += ` Q${pt([cx, cy])} ${pt([x, y])}`;
    }
  }
  d += ` L${pt([points.at(-1)![0], bottom])} Z`;
  return d;
}

/**
 * The moonlit face of a peak (the moon is up and to the right): from the summit down its right flank to `bottom`, and
 * back up a jagged spur line just right of the summit.
 */
export function litFace(peak: Pt, right: Pt, bottom: number, seed: number): string {
  const rand = seeded(seed);
  const [px, py] = peak;
  const [rx, ry] = right;
  // The foot of the spur: a little right of the summit, part-way down.
  const footX = px + (rx - px) * 0.22;
  const footY = py + (bottom - py) * 0.78;
  let d = `M${pt(peak)}`;
  // Down the right flank to the saddle, then curving back under the face to the spur's foot (never a ruled line).
  d += ` Q${pt([(px + rx) / 2, (py + ry) / 2 + Math.abs(rx - px) * 0.12])} ${pt(right)}`;
  d += ` Q${pt([rx - (rx - px) * 0.15, footY])} ${pt([footX, footY])}`;
  // Back up the spur: a zigzag to the summit.
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = footX + (px - footX) * t + (i < n ? (rand() - 0.3) * 3.4 : 0);
    const y = footY + (py - footY) * t;
    d += ` L${pt([x, y])}`;
  }
  return d + ' Z';
}

/**
 * A snow cap on a peak: the summit and a little of each flank, with a ragged lower edge (drips and gullies). `lit` is
 * the moonlit right half, drawn brighter over it.
 */
export function snowCap(peak: Pt, left: Pt, right: Pt, depth: number, seed: number): { cap: string; lit: string } {
  const rand = seeded(seed);
  const [px, py] = peak;
  const along = (to: Pt, t: number): Pt => [px + (to[0] - px) * t, py + (to[1] - py) * t];
  const tl = depth / Math.max(1, left[1] - py);
  const tr = depth / Math.max(1, right[1] - py);
  const l = along(left, Math.min(tl, 0.9));
  const r = along(right, Math.min(tr, 0.9));
  // The ragged edge from the right end back to the left: alternating drips (down) and gullies (up).
  const edge: Pt[] = [];
  const n = 7;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = r[0] + (l[0] - r[0]) * t;
    const base = r[1] + (l[1] - r[1]) * t;
    edge.push([x, base + (i % 2 ? 1 : -1) * (1.2 + rand() * 2.6)]);
  }
  const cap = `M${pt(l)} L${pt(peak)} L${pt(r)} ${edge.map((p) => `L${pt(p)}`).join(' ')} Z`;
  const mid = edge[Math.floor(edge.length / 2)]!;
  const lit = `M${pt(peak)} L${pt(r)} ${edge
    .slice(0, Math.floor(edge.length / 2) + 1)
    .map((p) => `L${pt(p)}`)
    .join(' ')} L${pt([px + 1.2, (py + mid[1]) / 2])} Z`;
  return { cap, lit };
}

/**
 * A pine as on the sign-in page: a trunk and curved tiers that narrow upwards, each with a moonlit right edge.
 */
export function pine(x: number, base: number, h: number, w: number, tiers: number): { d: string; lit: string } {
  const trunkH = h * 0.09;
  const cb = base - trunkH;
  const frac = 0.36;
  const tw = Math.max(0.7, w * 0.05);
  let d = `M${f(x - tw)} ${f(base + 2)} L${f(x - tw)} ${f(cb - 2)} L${f(x + tw)} ${f(cb - 2)} L${f(x + tw)} ${f(base + 2)} Z `;
  let lit = '';
  for (let i = 0; i < tiers; i++) {
    const bot = cb - ((h - trunkH) * (1 - frac) * i) / Math.max(1, tiers - 1);
    const th = (h - trunkH) * frac;
    const top = bot - th;
    const hw = (w / 2) * (1 - (0.74 * i) / Math.max(1, tiers - 1));
    d +=
      `M${f(x)} ${f(top)} Q${f(x - hw * 0.3)} ${f(top + th * 0.55)} ${f(x - hw)} ${f(bot)} ` +
      `Q${f(x - hw * 0.45)} ${f(bot - th * 0.2)} ${f(x)} ${f(bot - th * 0.06)} ` +
      `Q${f(x + hw * 0.45)} ${f(bot - th * 0.2)} ${f(x + hw)} ${f(bot)} ` +
      `Q${f(x + hw * 0.3)} ${f(top + th * 0.55)} ${f(x)} ${f(top)} Z `;
    // The lit edge: a sliver along the right side of the tier.
    lit +=
      `M${f(x)} ${f(top)} Q${f(x + hw * 0.3)} ${f(top + th * 0.55)} ${f(x + hw)} ${f(bot)} ` +
      `Q${f(x + hw * 0.62)} ${f(bot - th * 0.12)} ${f(x + hw * 0.38)} ${f(bot - th * 0.16)} ` +
      `Q${f(x + hw * 0.12)} ${f(top + th * 0.5)} ${f(x)} ${f(top)} Z `;
  }
  return { d, lit };
}

/** A row of pines between `from` and `to` along `base`, with seeded spacing, height and width. */
export function pineRow(opts: {
  seed: number;
  base: number;
  minH: number;
  maxH: number;
  spacing: number;
  from?: number;
  to?: number;
  aspect?: number;
  tiers?: number;
  skip?: (x: number) => boolean;
}): { d: string; lit: string } {
  const rand = seeded(opts.seed);
  const { from = -6, to = SCENE_WIDTH + 6, aspect = 0.46, tiers = 4 } = opts;
  let d = '';
  let lit = '';
  for (let x = from + rand() * opts.spacing; x < to; x += opts.spacing * (0.65 + rand() * 0.7)) {
    const h = opts.minH + rand() * (opts.maxH - opts.minH);
    const w = h * aspect * (0.85 + rand() * 0.3);
    const y = opts.base + rand() * 2.5;
    if (opts.skip?.(x)) continue;
    const p = pine(x, y, h, w, tiers);
    d += p.d;
    lit += p.lit;
  }
  return { d, lit };
}

/** The near shoreline: high on the left (the cabin's knoll), down towards the right. */
export const SHORE = 'M-4 244 C14 238 40 235 64 235 C88 235 112 240 140 243 C176 246 214 245 254 249';

export interface SidebarScene {
  stars: { x: number; y: number; r: number; o: number; twinkle: boolean; delay: string }[];
  farRange: string;
  farLit: string[];
  farSnow: { cap: string; lit: string }[];
  midRange: string;
  midLit: string[];
  midSnow: { cap: string; lit: string }[];
  treeline: string;
  shore: string;
  midPines: { d: string; lit: string };
  ground: string;
  path: string;
  frontPines: { d: string; lit: string };
  ripples: string[];
}

const FAR: Pt[] = [
  [-4, 176],
  [24, 152],
  [44, 162],
  [86, 120],
  [112, 146],
  [134, 138],
  [160, 104],
  [196, 146],
  [222, 132],
  [256, 160],
];
const MID: Pt[] = [
  [-4, 204],
  [30, 178],
  [58, 194],
  [96, 164],
  [128, 196],
  [150, 186],
  [186, 170],
  [214, 194],
  [256, 182],
];

/** Builds the scene's paths (once: the board never changes). */
export function buildSidebarScene(): SidebarScene {
  const rand = seeded(7);
  const stars = Array.from({ length: 22 }, (_, i) => ({
    x: f(6 + rand() * 238),
    y: f(46 + rand() * 82),
    r: f(rand() < 0.2 ? 0.9 : 0.5 + rand() * 0.3),
    o: f(0.35 + rand() * 0.55),
    twinkle: i % 4 === 0,
    delay: `${f(rand() * 3)}s`,
  })).filter((s) => Math.hypot(s.x - 200, s.y - 86) > 20); // not over the moon

  const peaksOf = (pts: readonly Pt[]) =>
    pts.flatMap((p, i) => (i > 0 && i < pts.length - 1 && p[1] < pts[i - 1]![1] && p[1] < pts[i + 1]![1] ? [i] : []));

  const farPeaks = peaksOf(FAR);
  const midPeaks = peaksOf(MID);

  return {
    stars,
    farRange: ridge(FAR, 230, 11),
    farLit: farPeaks.map((i) => litFace(FAR[i]!, FAR[i + 1]!, 230, 20 + i)),
    farSnow: farPeaks
      .filter((i) => FAR[i]![1] < 150)
      .map((i) => snowCap(FAR[i]!, FAR[i - 1]!, FAR[i + 1]!, FAR[i]![1] < 125 ? 15 : 8, 40 + i)),
    midRange: ridge(MID, 240, 12, 0.18),
    midLit: midPeaks.map((i) => litFace(MID[i]!, MID[i + 1]!, 240, 60 + i)),
    midSnow: midPeaks.filter((i) => MID[i]![1] < 172).map((i) => snowCap(MID[i]!, MID[i - 1]!, MID[i + 1]!, 6, 80 + i)),
    // Far shore: a soft line of tiny pines along the water.
    treeline: pineRow({ seed: 5, base: 222, minH: 6, maxH: 11, spacing: 4.2, aspect: 0.5, tiers: 3 }).d,
    // The near shore, rising to the right to the knoll the cabin stands on.
    shore: 'M-4 252 C30 246 70 247 110 243 C140 240 160 236 182 236 C204 236 222 240 254 244 L254 330 L-4 330 Z',
    midPines: pineRow({
      seed: 9,
      base: 266,
      minH: 22,
      maxH: 38,
      spacing: 11,
      tiers: 4,
      // Leave the knoll clear for the cabin, and a gap for the path.
      skip: (x) => (x > 34 && x < 100) || (x > 104 && x < 124),
    }),
    ground: 'M-4 274 C40 268 90 270 130 266 C170 263 210 266 254 262 L254 330 L-4 330 Z',
    // A footpath winding up from the bottom to the cabin's door.
    path: 'M120 330 C118 310 108 296 96 286 C86 278 76 266 66 256 L70 255 C82 264 96 274 106 284 C120 298 132 314 138 330 Z',
    frontPines: (() => {
      const left = pine(16, 324, 104, 50, 6);
      const left2 = pine(46, 330, 70, 34, 5);
      const right = pine(238, 326, 96, 46, 6);
      const right2 = pine(212, 332, 58, 28, 4);
      return {
        d: left.d + left2.d + right.d + right2.d,
        lit: left.lit + left2.lit + right.lit + right2.lit,
      };
    })(),
    // Ripples across the lake: short dashes, a few longer where the moon's light falls.
    ripples: [
      'M22 229 h14 M58 233 h10 M92 228 h12 M124 234 h9 M232 230 h12',
      'M40 238 h11 M76 241 h8 M110 239 h14 M150 242 h10 M226 238 h9',
    ],
  };
}
