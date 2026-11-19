import { useEffect, useRef, type CSSProperties } from 'react';
import { LOGIN_STILL, LOGIN_VIDEO, type PortraitFraming } from '../../lib/login-backdrop';
import { useReducedMotion } from '../../lib/motion';

/**
 * Covers the screen behind sign-in and account pages. The loop plays muted and inline, pauses while the tab is
 * hidden and picks up again when it comes back; with reduced motion (system or Settings) only the still shows.
 *
 * Portrait screens only show a narrow slice of the 16:9 picture, so it's framed on the guides by the fire (left of
 * centre) rather than the lake; given `framing` (lib/login-backdrop.ts) it's also a band along the bottom so the
 * guides show below the card, fading into the sky colour behind it.
 */
export function LoginBackdrop({ framing }: { framing?: PortraitFraming }) {
  const reduced = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // React doesn't always reflect `muted` to the element; some browsers won't autoplay without it.
    v.muted = true;
    v.defaultMuted = true;
    const sync = () => {
      if (document.hidden) v.pause();
      // A refused play() (low-power mode, say) leaves the poster showing, which is fine.
      else void v.play()?.catch(() => undefined);
    };
    if (document.hidden) v.pause();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [reduced]);

  const band: CSSProperties | undefined = framing && {
    top: 'auto',
    height: framing.height,
    maskImage: 'linear-gradient(transparent, #000 18%)',
  };
  const position: CSSProperties | undefined = framing && { objectPosition: `${framing.objectX}% 50%` };
  const fit = 'size-full object-cover object-[17%_50%] landscape:object-center';

  return (
    <div aria-hidden className="fixed inset-0 overflow-hidden" style={band}>
      {reduced ? (
        <img src={LOGIN_STILL} alt="" className={fit} style={position} />
      ) : (
        <video
          ref={video}
          src={LOGIN_VIDEO}
          poster={LOGIN_STILL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
          className={fit}
          style={position}
        />
      )}
    </div>
  );
}
