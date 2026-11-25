import { cx } from '../../lib/cx';
import { GUIDES, guideLabel, type GuideCharacter } from '../../lib/guides';

/** The guide fills only the middle of its square frame, so the frame is drawn this much larger than the guide's box. */
export const GUIDE_FRAME_SCALE = 1.5;
/** Centres the larger frame on the guide's box. */
export const GUIDE_FRAME_CLASS =
  'pointer-events-none absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2';

/**
 * One of the three guides as a 3D figure, still: the last frame of their waving-hello animation (public/mascots).
 * `size` is the guide's box; the transparent frame around the figure spills past it.
 *
 * It carries its own text alternative. Pass `decorative` where the character's name is already shown next to it (the
 * guide picker), so screen readers don't hear it twice.
 */
export function Guide({
  character,
  size = 120,
  decorative = false,
  className,
}: {
  character: GuideCharacter;
  /** The guide's box, in pixels. */
  size?: number;
  decorative?: boolean;
  className?: string;
}) {
  const drawn = Math.round(size * GUIDE_FRAME_SCALE);
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': guideLabel(character) } as const);
  return (
    <span
      className={cx('relative block shrink-0', className)}
      style={{ width: size, height: size }}
      data-guide={character}
      {...a11y}
    >
      <img
        src={GUIDES[character].wave.still}
        alt=""
        width={drawn}
        height={drawn}
        decoding="async"
        draggable={false}
        className={GUIDE_FRAME_CLASS}
        style={{ width: drawn, height: drawn }}
      />
    </span>
  );
}
