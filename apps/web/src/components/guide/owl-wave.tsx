import { useEffect, useRef, useState } from 'react';
import { guideLabel } from '../../lib/guides';
import { useReducedMotion } from '../../lib/motion';
import { Guide } from './guide';

/** The 3D owl waving hello (5 s, transparent, square), served from public/. */
export const OWL_WAVE_SRC = '/mascots/owl-wave.webm';
/** If the video hasn't shown a frame by then, the still owl stands in rather than an empty circle. */
const LOAD_GRACE_MS = 2500;

/**
 * Sage waving hello on the welcome screen: the 3D owl animation, muted, played once inline (it stops on its last
 * frame, mid-wave). The still owl (the drawn Sage) is shown instead when motion is reduced (the system setting or
 * Settings), and if the video can't play, is slow to arrive, or would show without its transparency (browsers that
 * don't support alpha in WebM draw a solid background, so the first frame's corner is checked). `size` is the box the
 * still owl is drawn at; the video is drawn larger and centred on it, because the owl fills only the middle of its frame.
 */
export function OwlWave({ size }: { size: number }) {
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

  if (reduced || state === 'still') return <Guide character="sage" size={size} ground={false} />;

  const drawn = Math.round(size * 1.5);
  return (
    <span
      role="img"
      aria-label={guideLabel('sage', 'waving')}
      className="relative block shrink-0"
      style={{ width: size, height: size }}
    >
      <video
        ref={video}
        src={OWL_WAVE_SRC}
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
        className="pointer-events-none absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300"
        style={{ width: drawn, height: drawn, opacity: state === 'playing' ? 1 : 0 }}
      />
    </span>
  );
}

/** Whether the video's top-left corner (empty space in this animation) is see-through, as it should be. */
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
