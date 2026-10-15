import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/** No clean photos yet: two instant photos of a tidy room, with a gold sparkle (style of EmptyIcons.dc.html). */
export function CareIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="Two photos of a tidy room with a gold sparkle"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="40" cy="40" r="35" fill="#DCE9F6" />
      <ellipse cx="40" cy="66" rx="23" ry="4.5" fill={url.shadow} />
      {/* Back photo */}
      <g transform="rotate(-9 30 40)">
        <rect x="14" y="20" width="30" height="34" rx="2.5" fill="#B9CCE2" transform="translate(1.5 1.5)" />
        <rect x="14" y="20" width="30" height="34" rx="2.5" fill={url.paper} />
        <rect x="17.5" y="23.5" width="23" height="21" rx="1.5" fill="#9DB7D3" />
        <path d="M17.5 38 L25 32 L31 37 L35 34 L40.5 38.5 V44.5 H17.5 Z" fill="#5B87B8" />
      </g>
      {/* Front photo: a made bed */}
      <g transform="rotate(7 50 42)">
        <rect x="35" y="22" width="30" height="35" rx="2.5" fill="#B9CCE2" transform="translate(1.5 1.5)" />
        <rect x="35" y="22" width="30" height="35" rx="2.5" fill={url.paper} />
        <rect x="38.5" y="25.5" width="23" height="22" rx="1.5" fill="#EAF1F8" />
        <rect x="41" y="36" width="18" height="8" rx="1.5" fill="#2E4F73" />
        <rect x="41" y="34" width="18" height="5" rx="1.5" fill="#5B87B8" />
        <rect x="42.5" y="31" width="6" height="3.5" rx="1.2" fill="#FFFFFF" />
        <rect x="51.5" y="31" width="6" height="3.5" rx="1.2" fill="#FFFFFF" />
        <rect x="38.5" y="25.5" width="23" height="22" rx="1.5" fill={url.sheen} />
        <rect x="40" y="50.5" width="12" height="2" rx="1" fill="#DADDD7" />
      </g>
      <g className="ei-stamp">
        <path d="M60 14 L61.8 18.2 L66 20 L61.8 21.8 L60 26 L58.2 21.8 L54 20 L58.2 18.2 Z" fill={url.gold} />
        <path d="M67 27 L67.9 29.1 L70 30 L67.9 30.9 L67 33 L66.1 30.9 L64 30 L66.1 29.1 Z" fill={url.gold} />
      </g>
    </svg>
  );
}
