import { useId } from 'react';
import { cx } from '../../lib/cx';

/**
 * The TruHost mark: a deep-green tile with the night scene from the sign-in page in miniature (mountains, a gold
 * moon) and a cream cabin whose door glows. Drawn on a 40×40 grid; ids are per instance, so several can share a page.
 * The same drawing is the favicon (public/favicon.svg).
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  const id = 'lm' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 40 40" className={cx('shrink-0', className)}>
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2F6B5F" />
          <stop offset="1" stopColor="#143934" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6DF94" />
          <stop offset="1" stopColor="#DDAE3E" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#F2D987" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F2D987" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <rect width="40" height="40" rx="11" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="40" height="40" fill={`url(#${id}-tile)`} />
        {/* Mountains, the far range lighter */}
        <path d="M-2 30 L7 21.5 L13 26 L20 21 L33 17 L42 24 V42 H-2 Z" fill="#5A9384" fillOpacity="0.5" />
        <path d="M-2 34 L7 27.5 L13 31 L21 25.5 L30 31.5 L42 27 V42 H-2 Z" fill="#0F2C28" fillOpacity="0.7" />
        {/* Moon */}
        <circle cx="30.5" cy="9.5" r="2.7" fill={`url(#${id}-gold)`} />
        {/* The cabin (with its chimney), its door lit */}
        <circle cx="20" cy="27" r="8" fill={`url(#${id}-glow)`} />
        <rect x="23.6" y="15" width="2.6" height="4.6" rx="0.6" fill="#F5F1E6" />
        <path
          d="M11.5 22 L20 14.5 L28.5 22 M14 20.2 V30.5 H26 V20.2"
          fill="none"
          stroke="#F5F1E6"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="17.9" y="23.6" width="4.2" height="6.9" rx="1" fill={`url(#${id}-gold)`} />
      </g>
      {/* Edge highlight, as on the sign-in tile */}
      <rect x="0.5" y="0.5" width="39" height="39" rx="10.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.16" />
    </svg>
  );
}

/** The mark with the wordmark, as on the sidebar. */
export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={44} className="drop-shadow-[0_4px_10px_rgb(0_0_0/0.25)]" />
      <div className="leading-none">
        <p className="text-[1.6rem] font-bold tracking-[-0.035em] text-sidebar-ink">
          Tru<span className="text-[#F2D987]">Host</span>
        </p>
        <p className="mt-1.5 text-[0.6rem] leading-[1.35] font-semibold tracking-[0.16em] text-sidebar-muted/85 uppercase">
          Vacation rental
          <br />
          management
        </p>
      </div>
    </div>
  );
}
