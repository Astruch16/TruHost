import { useEffect, useRef, useState } from 'react';
import { GUIDE_WAVES, guideLabel, type GuideCharacter } from '../../lib/guides';
import { useReducedMotion } from '../../lib/motion';

/** If the video hasn't shown a frame by then, the still stands in rather than an empty circle. */
const LOAD_GRACE_MS = 2500;
/** The guide fills only the middle of its square frame, so the frame is drawn this much larger than the guide's box. */
const FRAME_SCALE = 1.5;
const FRAME = 'pointer-events-none absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2';

/**
 * A guide waving hello in 3D, for the guide picker (the welcome screen and Settings): their animation (GUIDE_WAVES),
 * muted, played once inline (it stops on its last frame, mid-wave). The last frame as a still is shown instead when
 * motion is reduced (the system setting or Settings), and if the video can't play, is slow to arrive, or would show
 * without its transparency (browsers that don't support alpha in WebM draw a solid background, so the first frame's
 * corner is checked). Only for guides that have an animation; `size` is the guide's box.
 */
export function GuideWave({ character, size }: { character: GuideCharacter; size: number }) {
  const wave = GUIDE_WAVES[character]!;
  const reduced = useReducedMotion();
  const [state, setState] = useState<'loading' | 'playing' | 'still'>('loading');
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    // Set as properties too: some browsers only allow muted autoplay when `muted` is set before play.
    if (v) {
      v.muted = true;
      v.defaultMuted = true;
    }
    const timer = setTimeout(() => setState((s) => (s === 'loading' ? 'still' : s)), LOAD_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  const still = reduced || state === 'still';
  const drawn = Math.round(size * FRAME_SCALE);
  return (
    <span
      role="img"
      aria-label={guideLabel(character, 'waving')}
      className="relative block shrink-0"
      style={{ width: size, height: size }}
    >
      {still ? (
        <img
          src={wave.still}
          alt=""
          width={drawn}
          height={drawn}
          decoding="async"
          className={FRAME}
          style={{ width: drawn, height: drawn }}
        />
      ) : (
        <video
          ref={video}
          src={wave.video}
          muted
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden
          tabIndex={-1}
          width={drawn}
          height={drawn}
          onLoadedData={(e) => setState(hasTransparency(e.currentTarget) ? 'playing' : 'still')}
          onError={() => setState('still')}
          className={`${FRAME} transition-opacity duration-300`}
          style={{ width: drawn, height: drawn, opacity: state === 'playing' ? 1 : 0 }}
        />
      )}
    </span>
  );
}

/** Whether the video's top-left corner (empty space in these animations) is see-through, as it should be. */
function hasTransparency(v: HTMLVideoElement): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    ctx.drawImage(v, 0, 0, 8, 8, 0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data[3]! < 16;
  } catch {
    // Can't read the frame back: trust the browser rather than drop the animation.
    return true;
  }
}

/** A 3D guide, still (the animation's last frame), for small places such as the guide picker's buttons. Decorative. */
export function GuideStill({ character, size }: { character: GuideCharacter; size: number }) {
  const drawn = Math.round(size * FRAME_SCALE);
  return (
    <span aria-hidden className="relative block shrink-0" style={{ width: size, height: size }}>
      <img
        src={GUIDE_WAVES[character]!.still}
        alt=""
        width={drawn}
        height={drawn}
        decoding="async"
        className={FRAME}
        style={{ width: drawn, height: drawn }}
      />
    </span>
  );
}
