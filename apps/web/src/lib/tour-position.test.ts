import { describe, expect, it } from 'vitest';
import { placeCard, scrollTarget } from './tour-position';

const view = { width: 1280, height: 800 };
const card = { width: 360, height: 220 };

describe('placeCard', () => {
  it('centres the card when there is nothing to point at', () => {
    expect(placeCard(null, card, view)).toEqual({ top: 290, left: 460, placement: 'center' });
  });

  it('goes below the element, centred on it, when there is room', () => {
    expect(placeCard({ top: 100, left: 400, width: 200, height: 60 }, card, view)).toEqual({
      top: 174,
      left: 320,
      placement: 'below',
    });
  });

  it('goes above an element near the bottom, and keeps inside the screen', () => {
    expect(placeCard({ top: 600, left: 1200, width: 60, height: 40 }, card, view)).toEqual({
      top: 366,
      left: 904,
      placement: 'above',
    });
  });

  it('goes beside a tall element, and over the bottom of one that fills the screen', () => {
    expect(placeCard({ top: 150, left: 40, width: 500, height: 560 }, card, view).placement).toBe('right');
    expect(placeCard({ top: 0, left: 0, width: 1280, height: 800 }, card, view)).toEqual({
      top: 564,
      left: 460,
      placement: 'over',
    });
  });
});

describe('scrollTarget', () => {
  it('centres an element that fits, and puts a tall one near the top', () => {
    expect(scrollTarget({ top: 900, left: 0, width: 100, height: 200 }, view, 0, 0)).toBe(600);
    expect(scrollTarget({ top: 900, left: 0, width: 100, height: 1000 }, view, 100, 0)).toBe(976);
  });

  it('leaves room for the card under the element when both fit', () => {
    // 383 + 14 + 330 = 727 tall together: their top goes (800 − 727) / 2 = 36.5 from the top.
    expect(scrollTarget({ top: 216, left: 0, width: 100, height: 383 }, view, 0, 0, 330)).toBe(179.5);
    // Too tall together: the element alone is centred.
    expect(scrollTarget({ top: 216, left: 0, width: 100, height: 600 }, view, 0, 0, 330)).toBe(116);
  });

  it('leaves room for the bottom sheet on phones, and never scrolls above the top', () => {
    expect(scrollTarget({ top: 500, left: 0, width: 100, height: 100 }, view, 0, 300)).toBe(300);
    expect(scrollTarget({ top: 10, left: 0, width: 100, height: 100 }, view, 0, 0)).toBe(0);
  });
});
