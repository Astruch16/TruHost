import markUrl from '../../assets/brand/truhost-mark.svg?url';
import wordmarkUrl from '../../assets/brand/truhost-wordmark-dark.svg?url';

/**
 * The TruHost mark (assets/brand/truhost-mark.svg, a cream tile) with the wordmark (truhost-wordmark-dark.svg, for dark
 * backgrounds), as on the sidebar. The image's alt carries the name; the mark is decorative.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img
        src={markUrl}
        alt=""
        width={44}
        height={44}
        draggable={false}
        className="size-11 shrink-0 drop-shadow-[0_4px_10px_rgb(0_0_0/0.25)] select-none"
      />
      <div className="leading-none">
        <img
          src={wordmarkUrl}
          alt="TruHost"
          width={98}
          height={24}
          draggable={false}
          className="h-6 w-auto select-none"
        />
        <p className="mt-1.5 text-[0.6rem] leading-[1.35] font-semibold tracking-[0.16em] text-sidebar-muted/85 uppercase">
          Vacation rental
          <br />
          management
        </p>
      </div>
    </div>
  );
}
