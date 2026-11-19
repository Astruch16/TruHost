/**
 * The sign-in background loop (components/auth/login-backdrop.tsx): its files, and its framing on portrait screens.
 *
 * The loop is 16:9 with the guides by the fire in its lower half, left of centre. Covering a portrait screen shows
 * its full height and only a narrow slice of its width, which puts the guides behind a tall card. So on portrait
 * screens the backdrop becomes a band along the bottom, just tall enough that the guides start below the card (never
 * shorter than it takes to still cover the width, never taller than the screen), and the slice is centred on them.
 */

/**
 * The sign-in background: a 10-second loop of the guides by the campfire (H.264, 2560 × 1440 at 60 fps, its last
 * frame dropped so the loop doesn't show the first one twice), and its first frame as a still.
 */
export const LOGIN_VIDEO = '/login/login-loop.mp4';
export const LOGIN_STILL = '/login/login-still.webp';

/** The picture's aspect ratio. */
export const LOOP_RATIO = 16 / 9;
/** Where the guides start, top to bottom (the bear's ears), as a share of the picture's height. */
export const GUIDES_TOP = 0.55;
/** The middle of the guides and the fire, left to right, as a share of the picture's width. */
export const GUIDES_CENTRE = 0.26;

export interface PortraitFraming {
  /** Height of the band, in px, anchored to the bottom of the screen. */
  height: number;
  /** Horizontal object-position, 0 to 100 (%). */
  objectX: number;
}

/**
 * The band for a portrait screen whose content (card and tagline) ends `contentBottom` px from the top, leaving
 * `gap` px of sky between the content and the guides.
 */
export function portraitFraming(
  screen: { width: number; height: number },
  contentBottom: number,
  gap = 12,
): PortraitFraming {
  const fits = (screen.height - contentBottom - gap) / (1 - GUIDES_TOP);
  const covers = screen.width / LOOP_RATIO;
  const height = Math.round(Math.min(screen.height, Math.max(covers, fits)));
  // Share of the picture's width that shows, then the object-position that puts the guides in its middle.
  const shown = Math.min(1, screen.width / (height * LOOP_RATIO));
  const objectX = shown >= 1 ? 50 : ((GUIDES_CENTRE - shown / 2) / (1 - shown)) * 100;
  return { height, objectX: Math.round(Math.min(100, Math.max(0, objectX)) * 10) / 10 };
}
