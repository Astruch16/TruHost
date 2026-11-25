import { useEffect, useRef } from 'react';
import { cx } from '../../lib/cx';
import { useReducedMotion } from '../../lib/motion';
import { useDocumentHidden } from '../../lib/use-viewport';

/** Served as-is from apps/web/public/media. */
export const NAV_SCENE_VIDEO = '/media/nav-scene.mp4';
export const NAV_SCENE_POSTER = '/media/nav-scene-poster.webp';

/**
 * The sidebar's night scene: a looping clip of a cabin by a moonlit lake. Decorative only. Under reduced motion (the
 * system setting or "Reduce motion" in Settings) it is the still poster instead, and the clip pauses while the tab
 * is hidden. The sky fades in from the sidebar at the top, and the ground fades into the foot's colour at the bottom.
 */
export function NavScene({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const hidden = useDocumentHidden();
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (hidden) {
      el.pause();
    } else {
      // React sets `muted` as a property only, not the attribute; set both so every browser allows autoplay. A blocked
      // play() just leaves the poster showing.
      el.defaultMuted = true;
      el.muted = true;
      void el.play()?.catch(() => undefined);
    }
  }, [hidden, reduced]);

  return (
    <div aria-hidden className={cx('overflow-hidden', className)}>
      {reduced ? (
        <img
          src={NAV_SCENE_POSTER}
          alt=""
          draggable={false}
          className="size-full object-cover object-[40%_50%] select-none"
        />
      ) : (
        <video
          ref={video}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={NAV_SCENE_POSTER}
          aria-hidden="true"
          disablePictureInPicture
          className="size-full object-cover object-[40%_50%]"
        >
          <source src={NAV_SCENE_VIDEO} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-sidebar to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-b from-transparent to-[#0a1827]" />
    </div>
  );
}
