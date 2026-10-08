import { describe, expect, it } from 'vitest';
import boardHtml from '../../../../docs/design/Login.dc.html?raw';
import {
  cullScene,
  generateLoginScene,
  loginScene,
  phoneCardOffset,
  sceneViewBox,
  sceneViewBoxAroundCard,
} from './login-scene';

/** Runs the script block of docs/design/Login.dc.html exactly as the design tool would. */
function boardScene() {
  const script = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(boardHtml)![1]!;
  class DCLogic {
    state: Record<string, unknown> = {};
    constructor(public props: unknown) {}
    setState(s: Record<string, unknown>) {
      Object.assign(this.state, s);
    }
  }
  const Component = new Function('DCLogic', `${script}; return Component;`)(DCLogic) as new (p: unknown) => {
    renderVals(): Record<string, unknown>;
  };
  return new Component({}).renderVals();
}

describe('login scene', () => {
  it('generates exactly what the design board generates', () => {
    const board = boardScene();
    const ours = generateLoginScene();
    for (const key of [
      'stars',
      'sparkles',
      'ripples',
      'reflect',
      'backTrees',
      'midTrees',
      'bigTrees',
      'fireflies',
    ] as const) {
      // Trees also carry their position (for culling on phones); everything the board generates must match.
      const drawn = (ours[key] as object[]).map((item) =>
        Object.fromEntries(
          Object.entries(item)
            .filter(([k]) => k !== 'x' || !('halfWidth' in item))
            .filter(([k]) => k !== 'halfWidth'),
        ),
      );
      expect(drawn, key).toEqual(board[key]);
    }
  });

  it('has the board’s counts, with a gap in the middle row for the cabin', () => {
    const s = generateLoginScene();
    expect([s.stars, s.sparkles, s.ripples, s.reflect, s.bigTrees, s.fireflies].map((a) => a.length)).toEqual([
      110, 6, 7, 9, 8, 16,
    ]);
    expect(s.backTrees.length).toBe(72);
    expect(s.midTrees.length).toBeLessThan(32);
  });

  it('is generated once and reused', () => {
    expect(loginScene()).toBe(loginScene());
  });
});

describe('sceneViewBox', () => {
  const parse = (vb: string) => vb.split(' ').map(Number) as [number, number, number, number];
  const shows = (vb: string, from: number, to: number) => {
    const [x, , w] = parse(vb);
    return x <= from && to <= x + w;
  };

  it.each([
    [1440, 900],
    [1920, 1080],
    [2560, 1080],
  ])('shows the whole canvas at %i×%i, as the board does', (w, h) => {
    expect(sceneViewBox(w, h)).toBe('0 0 1440 900');
  });

  it.each([
    [390, 844], // phone
    [360, 740],
    [430, 932],
    [768, 1024], // tablet portrait
    [1024, 1366],
    [1280, 1000],
  ])('keeps the cabin and the moon in view at %i×%i', (w, h) => {
    const vb = sceneViewBox(w, h);
    expect(shows(vb, 978, 1146), `cabin in ${vb}`).toBe(true);
    expect(shows(vb, 1194, 1266), `moon in ${vb}`).toBe(true);
    const [x, y, vw, vh] = parse(vb);
    expect([y, vh]).toEqual([0, 900]);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x + vw).toBeLessThanOrEqual(1440.1);
    expect(vw / vh).toBeCloseTo(w / h, 2); // same shape as the screen: no stretching or letterboxing
  });
});

describe('sceneViewBoxAroundCard', () => {
  /** Where a canvas y lands on screen for a viewBox, given the screen height. */
  const toScreen = (vb: string, screenH: number, canvasY: number) => {
    const [, y, , h] = vb.split(' ').map(Number) as [number, number, number, number];
    return ((canvasY - y) / h) * screenH;
  };
  it.each([
    [390, 844, 116, 671, 40],
    [430, 932, 140, 700, 40],
    [375, 667, 40, 580, 40],
    // A short phone: the roof tucks further under the card, but the moon, cabin and lake still show.
    [360, 740, 67, 640, 90],
  ])('at %i×%i with the card at %i–%i: whole moon above, cabin and lake at the bottom', (w, h, top, bottom, tuck) => {
    const vb = sceneViewBoxAroundCard(w, h, top, bottom);
    const [x, , vw, vh] = vb.split(' ').map(Number) as [number, number, number, number];
    expect(toScreen(vb, h, 176)).toBeCloseTo(top - 12, 0); // moon's lower edge just above the card
    expect(x).toBeLessThanOrEqual(978); // cabin's left wall
    expect(x + vw).toBeGreaterThanOrEqual(1266); // moon's right edge
    expect(toScreen(vb, h, 596)).toBeGreaterThan(bottom - tuck); // roof at most a little under the card
    expect(toScreen(vb, h, 640)).toBeLessThan(h); // the lake shows below the card
    expect(vw / vh).toBeCloseTo(w / h, 2);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x + vw).toBeLessThanOrEqual(1440.1);
  });

  it('falls back to the plain framing without a card', () => {
    expect(sceneViewBoxAroundCard(390, 844, 0, 0)).toBe(sceneViewBox(390, 844));
  });
});

describe('phoneCardOffset', () => {
  it.each([
    [844, 555, 116],
    [932, 555, 140], // capped
    [740, 573, 67],
    [600, 573, 24], // floor: the form stays in view
  ])('screen %i, card %i → %ipx above the card', (screen, card, expected) => {
    expect(phoneCardOffset(screen, card)).toBe(expected);
  });
});

describe('cullScene', () => {
  it('keeps everything for a full view', () => {
    const scene = generateLoginScene();
    expect(cullScene(scene, '0 0 1440 900')).toBe(scene);
  });

  it('keeps only what can be seen in a phone’s slice, and everything that can', () => {
    const scene = generateLoginScene();
    const culled = cullScene(scene, '972 102 300 649');
    expect(culled.stars.length).toBeLessThan(scene.stars.length / 3);
    expect(culled.backTrees.length).toBeLessThan(scene.backTrees.length / 3);
    for (const s of scene.stars.filter((s) => s.x >= 972 && s.x <= 1272)) expect(culled.stars).toContain(s);
    for (const t of scene.backTrees.filter((t) => t.x >= 972 && t.x <= 1272)) expect(culled.backTrees).toContain(t);
    expect(culled.ripples).toBe(scene.ripples); // the lake spans the whole width
  });
});
