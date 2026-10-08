import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/** "Where the revenue went" is empty: a pie chart with a gold coin (docs/design/EmptyIcons.dc.html). */
export function RevenueIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A pie chart with a gold coin"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="40" cy="40" r="35" fill="#DDEBDF" />
      <ellipse cx="40" cy="66" rx="24" ry="4.5" fill={url.shadow} />
      <circle cx="36" cy="39" r="20" fill="#2F5548" />
      <circle cx="36" cy="36" r="20" fill="#4F7A63" />
      <path className="ei-pop" d="M36 36 L36 16 A20 20 0 0 1 54.4 28.2 Z" fill="#A99BD6" />
      <path d="M36 36 L54.4 28.2 A20 20 0 0 1 56 36 Z" fill="#7FA9DC" />
      <circle cx="36" cy="36" r="20" fill={url.sheen} />
      <path
        d="M21 26 A18 18 0 0 1 30 18"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g className="ei-float">
        <circle cx="53" cy="53.5" r="10.5" fill="#C99A2E" />
        <circle cx="52" cy="51.5" r="10.5" fill={url.gold} />
        <circle cx="52" cy="51.5" r="6.5" fill="none" stroke="#C99A2E" strokeWidth="1.6" />
        <path
          d="M45.5 47 A8 8 0 0 1 50 43.5"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.7"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
