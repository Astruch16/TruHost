/**
 * Where a tour step's card goes: beside the highlighted element when there's room (below, then above, then right,
 * then left), otherwise over the bottom of the screen. Pure, so it is unit-tested.
 */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type Placement = 'below' | 'above' | 'right' | 'left' | 'over' | 'center';

const GAP = 14;
const MARGIN = 16;

export function placeCard(
  anchor: Box | null,
  card: { width: number; height: number },
  view: { width: number; height: number },
): { top: number; left: number; placement: Placement } {
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), Math.max(MARGIN, view.width - card.width - MARGIN));
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), Math.max(MARGIN, view.height - card.height - MARGIN));
  if (!anchor) {
    return {
      top: clampY((view.height - card.height) / 2),
      left: clampX((view.width - card.width) / 2),
      placement: 'center',
    };
  }
  const centredX = clampX(anchor.left + anchor.width / 2 - card.width / 2);
  const centredY = clampY(anchor.top + anchor.height / 2 - card.height / 2);
  const below = anchor.top + anchor.height + GAP;
  if (below + card.height + MARGIN <= view.height) return { top: below, left: centredX, placement: 'below' };
  const above = anchor.top - GAP - card.height;
  if (above >= MARGIN) return { top: above, left: centredX, placement: 'above' };
  const right = anchor.left + anchor.width + GAP;
  if (right + card.width + MARGIN <= view.width) return { top: centredY, left: right, placement: 'right' };
  const left = anchor.left - GAP - card.width;
  if (left >= MARGIN) return { top: centredY, left, placement: 'left' };
  // A large element: the card sits over its lower part, at the bottom of the screen.
  return { top: clampY(view.height - card.height - MARGIN), left: centredX, placement: 'over' };
}

/**
 * How far to scroll the window so the element is in view, with the card below it when both fit (desktop), else the
 * element centred, else its top just under the top edge. On phones the bottom sheet covers the lower part of the
 * screen, so the element is placed in the space above it.
 */
export function scrollTarget(anchor: Box, view: { height: number }, scrollY: number, sheet: number, card = 0): number {
  const room = view.height - sheet;
  const withCard = card > 0 ? anchor.height + GAP + card : anchor.height;
  const top =
    withCard + 48 <= room ? (room - withCard) / 2 : anchor.height + 48 <= room ? (room - anchor.height) / 2 : 24;
  return Math.max(0, scrollY + anchor.top - top);
}
