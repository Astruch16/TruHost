import { describe, expect, it } from 'vitest';
import { GUIDES_CENTRE, LOOP_RATIO, portraitFraming } from './login-backdrop';

const phone = { width: 390, height: 844 };

/** The share of the picture's width that shows, and where the middle of it falls. */
function shownMiddle(screen: { width: number }, f: { height: number; objectX: number }) {
  const shown = screen.width / (f.height * LOOP_RATIO);
  return (1 - shown) * (f.objectX / 100) + shown / 2;
}

describe('portraitFraming', () => {
  it('shrinks to a band whose guides start just below a tall card', () => {
    const f = portraitFraming(phone, 616);
    expect(f.height).toBe(480); // (844 − 616 − 12) / 0.45
    expect(phone.height - f.height * 0.45).toBeGreaterThanOrEqual(616 + 12 - 1);
  });

  it('fills the screen when the card is short enough to clear the guides', () => {
    expect(portraitFraming(phone, 368).height).toBe(844);
  });

  it('never gets so short that it stops covering the width', () => {
    expect(portraitFraming({ width: 375, height: 667 }, 640).height).toBe(211); // 375 × 9 / 16
    expect(portraitFraming(phone, 2000).height).toBe(219);
  });

  it('centres the slice that shows on the guides', () => {
    for (const bottom of [368, 520, 616]) {
      const f = portraitFraming(phone, bottom);
      expect(shownMiddle(phone, f)).toBeCloseTo(GUIDES_CENTRE, 2);
    }
    const tablet = { width: 820, height: 1180 };
    expect(shownMiddle(tablet, portraitFraming(tablet, 666))).toBeCloseTo(GUIDES_CENTRE, 2);
  });

  it('keeps the position inside the picture when the slice is wide', () => {
    const f = portraitFraming({ width: 375, height: 667 }, 640);
    expect(f.objectX).toBe(0);
    expect(portraitFraming({ width: 900, height: 920 }, 100).objectX).toBeGreaterThanOrEqual(0);
  });
});
