/**
 * Generator for the sidebar's mountain-and-pine scene. Pure and seeded, so the scene is identical on every render
 * and in tests.
 *
 * PROVISIONAL: recreated from the design screenshot. Replace with the generator ported from
 * docs/design/Main.dc.html once that file is in the repo.
 */

export const SCENE_WIDTH = 250;
export const SCENE_HEIGHT = 330;

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

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A pine silhouette: stacked tiers that narrow toward the top, plus a short trunk. */
export function pinePath(x: number, baseY: number, height: number, width: number, tiers = 4): string {
  const trunkH = height * 0.08;
  const crownBase = baseY - trunkH;
  const crownH = height - trunkH;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const y = crownBase - crownH * t;
    const half = (width / 2) * (1 - t * 0.78);
    const notchY = y - crownH / tiers + crownH * 0.06;
    const notchHalf = half * 0.42;
    left.push(`${r1(x - half)},${r1(y)}`, `${r1(x - notchHalf)},${r1(notchY)}`);
    right.unshift(`${r1(x + notchHalf)},${r1(notchY)}`, `${r1(x + half)},${r1(y)}`);
  }
  const apex = `${r1(x)},${r1(crownBase - crownH)}`;
  const tw = Math.max(width * 0.06, 0.8);
  const trunk = [
    `${r1(x + tw)},${r1(crownBase)}`,
    `${r1(x + tw)},${r1(baseY)}`,
    `${r1(x - tw)},${r1(baseY)}`,
    `${r1(x - tw)},${r1(crownBase)}`,
  ];
  return `M${[...left, apex, ...right.slice(0, -1), ...trunk].join(' L')} Z`;
}

/** A row of pines along `baseY`, with seeded jitter in spacing, height and width. */
export function pineRow(opts: {
  seed: number;
  baseY: number;
  minHeight: number;
  maxHeight: number;
  spacing: number;
  from?: number;
  to?: number;
  aspect?: number;
}): string {
  const rand = seeded(opts.seed);
  const { from = -10, to = SCENE_WIDTH + 10, aspect = 0.42 } = opts;
  const paths: string[] = [];
  for (let x = from + rand() * opts.spacing; x < to; x += opts.spacing * (0.7 + rand() * 0.6)) {
    const h = opts.minHeight + rand() * (opts.maxHeight - opts.minHeight);
    paths.push(pinePath(x, opts.baseY + rand() * 3, h, h * aspect * (0.85 + rand() * 0.3)));
  }
  return paths.join(' ');
}

type Pt = readonly [number, number];

/** Ridge outlines designed at the sidebar width (250); scaled horizontally for wider scenes. */
const BACK_RANGE: Pt[] = [
  [0, 150],
  [42, 118],
  [80, 140],
  [128, 72],
  [168, 104],
  [208, 52],
  [250, 96],
];
const BACK_SNOW: Pt[][] = [
  [
    [118, 86],
    [128, 72],
    [138, 86],
    [131, 82],
    [126, 88],
  ],
  [
    [198, 66],
    [208, 52],
    [218, 66],
    [211, 62],
    [205, 70],
  ],
];
const MID_RANGE: Pt[] = [
  [0, 182],
  [52, 150],
  [96, 170],
  [150, 128],
  [198, 166],
  [250, 136],
];

function polygon(points: Pt[], sx: number, close?: { bottom: number; width: number }): string {
  const pts = points.map(([x, y]) => `${r1(x * sx)},${y}`);
  const tail = close ? ` L${close.width},${close.bottom} L0,${close.bottom}` : '';
  return `M${pts.join(' L')}${tail} Z`;
}

export interface Scene {
  width: number;
  backRange: string;
  backSnow: string[];
  midRange: string;
  farPines: string;
  hill: string;
  midPines: string;
  ground: string;
  frontPines: string;
}

/** Builds the scene for a given width (height is always SCENE_HEIGHT). Pines keep their size; ridges stretch. */
export function buildScene(width = SCENE_WIDTH): Scene {
  const sx = width / SCENE_WIDTH;
  const bottom = { bottom: SCENE_HEIGHT, width };
  const W = width;
  return {
    width,
    backRange: polygon(BACK_RANGE, sx, bottom),
    backSnow: BACK_SNOW.map((s) => polygon(s, sx)),
    midRange: polygon(MID_RANGE, sx, bottom),
    farPines: pineRow({ seed: 7, baseY: 236, minHeight: 12, maxHeight: 24, spacing: 21, aspect: 0.36, to: W + 10 }),
    hill: `M0,252 C${r1(W * 0.24)},236 ${r1(W * 0.48)},246 ${r1(W * 0.68)},240 C${r1(W * 0.82)},236 ${r1(W * 0.93)},244 ${W},240 L${W},${SCENE_HEIGHT} L0,${SCENE_HEIGHT} Z`,
    midPines: pineRow({ seed: 21, baseY: 272, minHeight: 34, maxHeight: 58, spacing: 22, to: W + 10 }),
    ground: `M0,292 C${r1(W * 0.28)},284 ${r1(W * 0.64)},296 ${W},286 L${W},${SCENE_HEIGHT} L0,${SCENE_HEIGHT} Z`,
    frontPines: [
      pineRow({ seed: 42, baseY: 318, minHeight: 90, maxHeight: 130, spacing: 26, from: -18, to: 48 }),
      pineRow({ seed: 43, baseY: 320, minHeight: 70, maxHeight: 120, spacing: 26, from: W - 54, to: W + 18 }),
      pineRow({ seed: 44, baseY: 322, minHeight: 40, maxHeight: 62, spacing: 30, from: 70, to: W - 70 }),
    ].join(' '),
  };
}
