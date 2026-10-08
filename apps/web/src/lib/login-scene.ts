/**
 * The sign-in scene's generated parts (trees, stars, sparkles, lake ripples, moon reflection, fireflies), ported
 * statement for statement from the script block of docs/design/Login.dc.html: same seeded generator, same order of
 * draws, same rounding. login-scene.test.ts runs the board's own script and requires identical output.
 *
 * Pure and deterministic, so it is computed once (see `loginScene`) rather than on every render.
 */

export interface SceneTree {
  /** Dark silhouette (trunk and tiers). */
  d: string;
  /** Moonlit right-hand edge of each tier. */
  lit: string;
  /** Wind timing: trees further right start later, so a gust moves across the scene. */
  delay: string;
  dur: string;
  /** Where the trunk stands and how far the branches reach either side (not on the board: used to skip trees
   *  that are off screen on phones). */
  x: number;
  halfWidth: number;
}
export interface SceneWave {
  d: string;
  /** How far one loop moves (one wavelength), as a CSS length for `--wl`. */
  wl: string;
  dur: string;
  op: string;
  /** Stroke width (moon reflection only). */
  sw?: string;
}
export interface SceneStar {
  x: number;
  y: number;
  r: number;
  delay: string;
  dur: string;
}
export interface SceneSparkle {
  d: string;
  delay: string;
}
export interface SceneFirefly {
  x: number;
  y: number;
  delay: string;
  dur: string;
}
export interface LoginScene {
  stars: SceneStar[];
  sparkles: SceneSparkle[];
  ripples: SceneWave[];
  reflect: SceneWave[];
  backTrees: SceneTree[];
  midTrees: SceneTree[];
  bigTrees: SceneTree[];
  fireflies: SceneFirefly[];
}

export function generateLoginScene(): LoginScene {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const f1 = (v: number) => Math.round(v * 10) / 10;

  const tree = (x: number, base: number, h: number, w: number, n: number): SceneTree => {
    const trunkH = h * 0.08;
    const cb = base - trunkH;
    const frac = 0.34;
    let dark = '';
    let lit = '';
    const tw = Math.max(1.5, w * 0.05);
    dark +=
      'M' +
      f1(x - tw) +
      ' ' +
      f1(base + 6) +
      ' L' +
      f1(x - tw) +
      ' ' +
      f1(cb - 4) +
      ' L' +
      f1(x + tw) +
      ' ' +
      f1(cb - 4) +
      ' L' +
      f1(x + tw) +
      ' ' +
      f1(base + 6) +
      'Z ';
    for (let i = 0; i < n; i++) {
      const bot = cb - ((h - trunkH) * (1 - frac) * i) / (n - 1);
      const th = (h - trunkH) * frac;
      const top = bot - th;
      const hw = (w / 2) * (1 - (0.74 * i) / (n - 1));
      dark +=
        'M' +
        f1(x) +
        ' ' +
        f1(top) +
        ' Q' +
        f1(x - hw * 0.3) +
        ' ' +
        f1(top + th * 0.55) +
        ' ' +
        f1(x - hw) +
        ' ' +
        f1(bot) +
        ' Q' +
        f1(x - hw * 0.45) +
        ' ' +
        f1(bot - th * 0.2) +
        ' ' +
        f1(x) +
        ' ' +
        f1(bot - th * 0.06) +
        ' Q' +
        f1(x + hw * 0.45) +
        ' ' +
        f1(bot - th * 0.2) +
        ' ' +
        f1(x + hw) +
        ' ' +
        f1(bot) +
        ' Q' +
        f1(x + hw * 0.3) +
        ' ' +
        f1(top + th * 0.55) +
        ' ' +
        f1(x) +
        ' ' +
        f1(top) +
        'Z ';
      lit +=
        'M' +
        f1(x) +
        ' ' +
        f1(top) +
        ' Q' +
        f1(x + hw * 0.3) +
        ' ' +
        f1(top + th * 0.55) +
        ' ' +
        f1(x + hw) +
        ' ' +
        f1(bot) +
        ' Q' +
        f1(x + hw * 0.6) +
        ' ' +
        f1(bot - th * 0.16) +
        ' ' +
        f1(x + hw * 0.18) +
        ' ' +
        f1(bot - th * 0.12) +
        ' Q' +
        f1(x + hw * 0.12) +
        ' ' +
        f1(top + th * 0.5) +
        ' ' +
        f1(x) +
        ' ' +
        f1(top) +
        'Z ';
    }
    const dur = 6 + rnd() * 0.6;
    const delay = -dur + (x / 1440) * 2.4 + rnd() * 0.3;
    return { d: dark, lit, delay: delay.toFixed(2) + 's', dur: dur.toFixed(2) + 's', x, halfWidth: w / 2 };
  };

  const wave = (y0: number, amp: number, len: number, from: number, to: number) => {
    let d =
      'M' + from + ' ' + y0 + ' Q' + f1(from + len / 4) + ' ' + f1(y0 - amp) + ' ' + f1(from + len / 2) + ' ' + y0;
    for (let xx = from + len; xx <= to; xx += len / 2) d += ' T' + f1(xx) + ' ' + y0;
    return d;
  };

  const ripples: SceneWave[] = [];
  for (let r = 0; r < 7; r++) {
    const len = 70 + rnd() * 50;
    const dir = r % 2 === 0 ? -1 : 1;
    ripples.push({
      d: wave(626 + r * 10.5, 1.4 + rnd() * 1.4, len, -2 * len, 1440 + 2 * len),
      wl: (dir * len).toFixed(1) + 'px',
      dur: (7 + rnd() * 6).toFixed(2) + 's',
      op: (0.12 + rnd() * 0.12).toFixed(2),
    });
  }

  const reflect: SceneWave[] = [];
  for (let m = 0; m < 9; m++) {
    const rl = 22 + rnd() * 16;
    const rdir = m % 2 === 0 ? -1 : 1;
    reflect.push({
      d: wave(624 + m * 7.5, 1.8 + rnd() * 1.2, rl, 1060 - 2 * rl, 1400 + 2 * rl),
      wl: (rdir * rl).toFixed(1) + 'px',
      dur: (2.6 + rnd() * 2).toFixed(2) + 's',
      op: (0.85 - m * 0.07).toFixed(2),
      sw: (2.6 - m * 0.15).toFixed(2),
    });
  }

  const stars: SceneStar[] = [];
  for (let s = 0; s < 110; s++) {
    stars.push({
      x: f1(rnd() * 1440),
      y: f1(rnd() * 470),
      r: f1(0.5 + rnd() * 1.4),
      delay: (-rnd() * 4).toFixed(2) + 's',
      dur: (2.4 + rnd() * 3).toFixed(2) + 's',
    });
  }

  const sparkle = (x: number, y: number, r: number) =>
    'M' +
    x +
    ' ' +
    (y - r) +
    ' Q' +
    (x + r * 0.15) +
    ' ' +
    (y - r * 0.15) +
    ' ' +
    (x + r) +
    ' ' +
    y +
    ' Q' +
    (x + r * 0.15) +
    ' ' +
    (y + r * 0.15) +
    ' ' +
    x +
    ' ' +
    (y + r) +
    ' Q' +
    (x - r * 0.15) +
    ' ' +
    (y + r * 0.15) +
    ' ' +
    (x - r) +
    ' ' +
    y +
    ' Q' +
    (x - r * 0.15) +
    ' ' +
    (y - r * 0.15) +
    ' ' +
    x +
    ' ' +
    (y - r) +
    'Z';
  const sparkles: SceneSparkle[] = (
    [
      [140, 90, 6],
      [430, 170, 5],
      [820, 70, 6],
      [980, 240, 4],
      [1360, 60, 5],
      [300, 300, 4],
    ] as const
  ).map((p) => ({ d: sparkle(p[0], p[1], p[2]), delay: (-rnd() * 4).toFixed(2) + 's' }));

  const row = (
    count: number,
    base: number,
    waveAmp: number,
    hmin: number,
    hvar: number,
    skipFrom: number,
    skipTo: number,
    n: number,
  ) => {
    const out: SceneTree[] = [];
    for (let k = 0; k < count; k++) {
      const x = ((k + 0.5) * 1440) / count + (rnd() - 0.5) * 20;
      if (x > skipFrom && x < skipTo) continue;
      const b = base + Math.sin(x / 180) * waveAmp + (rnd() - 0.5) * 6;
      const h = hmin + rnd() * hvar;
      out.push(tree(x, b, h, h * (0.36 + rnd() * 0.14), n));
    }
    return out;
  };
  const backTrees = row(72, 606, 9, 22, 26, 9999, 9999, 4);
  // The middle row leaves a gap where the cabin stands.
  const midTrees = row(32, 702, 12, 58, 52, 940, 1150, 5);
  const bigTrees = (
    [
      [34, 400, 7],
      [112, 320, 6],
      [184, 250, 6],
      [246, 190, 5],
      [300, 140, 5],
      [1300, 280, 6],
      [1360, 360, 7],
      [1420, 420, 7],
    ] as const
  ).map((t) => tree(t[0], 834, t[1], t[1] * 0.42, t[2]));

  const fireflies: SceneFirefly[] = [];
  for (let q = 0; q < 16; q++) {
    const fx = rnd() < 0.5 ? 60 + rnd() * 420 : 960 + rnd() * 420;
    fireflies.push({
      x: f1(fx),
      y: f1(650 + rnd() * 140),
      delay: (-rnd() * 4).toFixed(2) + 's',
      dur: (3 + rnd() * 3).toFixed(2) + 's',
    });
  }

  return { stars, sparkles, ripples, reflect, backTrees, midTrees, bigTrees, fireflies };
}

let cached: LoginScene | null = null;
/** The scene, generated on first use and reused for the life of the page. */
export function loginScene(): LoginScene {
  return (cached ??= generateLoginScene());
}

/** The scene is drawn on a 1440 × 900 canvas. */
export const SCENE_WIDTH = 1440;
export const SCENE_HEIGHT = 900;
/** Middle of the part that must stay in view on narrow screens: the cabin (x ≈ 978–1146) and the moon (≈ 1194–1266). */
const NARROW_FOCUS_X = 1110;

/**
 * The viewBox for a screen of `width` × `height`. Wide screens see the whole canvas (cropped top or bottom as on the
 * board). Narrower screens see a full-height slice, centred on the cabin and moon instead of the middle, so a phone
 * still shows the moon, the lake and the cabin.
 */
export function sceneViewBox(width: number, height: number): string {
  if (width <= 0 || height <= 0) return `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`;
  const visible = Math.min(SCENE_WIDTH, (SCENE_HEIGHT * width) / height);
  if (visible >= SCENE_WIDTH) return `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`;
  const center = Math.min(Math.max(NARROW_FOCUS_X, visible / 2), SCENE_WIDTH - visible / 2);
  const x = Math.round((center - visible / 2) * 10) / 10;
  return `${x} 0 ${Math.round(visible * 10) / 10} ${SCENE_HEIGHT}`;
}

/** Landmarks on the canvas used to frame phones (see `sceneViewBoxAroundCard`). */
const MOON_BOTTOM = 176; // moon centre 140, radius 36
const CABIN_TOP = 596; // chimney cap and roof ridge
const MOON_X: [number, number] = [1194, 1266];
const CABIN_X: [number, number] = [978, 1146];
/** Moon and cabin side by side, with a little room. */
const MIN_VISIBLE_WIDTH = 300;

/**
 * Phones: the card covers most of the screen, so frame the scene around it. The moon sits just above the card,
 * and the cabin and lake just below it, scaled to fit (but never zoomed in so far that the moon and cabin can't both
 * be seen), horizontally centred on the moon and cabin. Areas beyond the
 * canvas are covered by the plain sky and ground bands LoginScene draws around it.
 */
export function sceneViewBoxAroundCard(width: number, height: number, cardTop: number, cardBottom: number): string {
  if (width <= 0 || height <= 0 || cardBottom <= cardTop) return sceneViewBox(width, height);
  const gapAbove = 12;
  const gapBelow = 14;
  // Zoom just enough to fit the card between moon and cabin, but never so far that the moon and the cabin (300
  // canvas units side by side) don't both fit across the screen; then the cabin's roof tucks under the card a little.
  const fit = (cardBottom + gapBelow - (cardTop - gapAbove)) / (CABIN_TOP - MOON_BOTTOM);
  const scale = Math.min(fit, width / MIN_VISIBLE_WIDTH);
  const y = MOON_BOTTOM - (cardTop - gapAbove) / scale;
  const w = width / scale;
  const h = height / scale;
  const center = (Math.min(MOON_X[0], CABIN_X[0]) + Math.max(MOON_X[1], CABIN_X[1])) / 2;
  const x = Math.min(Math.max(center - w / 2, 0), Math.max(0, SCENE_WIDTH - w));
  const r = (v: number) => Math.round(v * 10) / 10;
  return `${r(x)} ${r(y)} ${r(w)} ${r(h)}`;
}

/**
 * Phones: space above the card, in px. Uses 40% of the height the card leaves free (so the moon fits above it),
 * between 24px and 140px.
 */
export function phoneCardOffset(screenHeight: number, cardHeight: number): number {
  return Math.round(Math.min(140, Math.max(24, (screenHeight - cardHeight) * 0.4)));
}

/**
 * Phones see a narrow slice of the canvas. Leaving out what lies outside it (trees, stars, fireflies) changes
 * nothing on screen but saves animating it. Returns the scene unchanged for a full view.
 */
export function cullScene(scene: LoginScene, viewBox: string): LoginScene {
  const [x, , w] = viewBox.split(' ').map(Number) as [number, number, number, number];
  if (x <= 0 && x + w >= SCENE_WIDTH) return scene;
  const margin = 40; // swaying, twinkling and drifting reach a little past their position
  const inView = (from: number, to: number) => to >= x - margin && from <= x + w + margin;
  const trees = (list: SceneTree[]) => list.filter((t) => inView(t.x - t.halfWidth, t.x + t.halfWidth));
  return {
    ...scene,
    stars: scene.stars.filter((s) => inView(s.x, s.x)),
    fireflies: scene.fireflies.filter((f) => inView(f.x, f.x + 12)),
    backTrees: trees(scene.backTrees),
    midTrees: trees(scene.midTrees),
    bigTrees: trees(scene.bigTrees),
  };
}
