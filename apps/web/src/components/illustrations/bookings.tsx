import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/** No stays: a calendar page with one stay marked (docs/design/EmptyIcons.dc.html). */
export function BookingsIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A calendar page with one stay marked"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'gold', 'paper']} />
      <circle cx="40" cy="40" r="35" fill="#DCE8F5" />
      <ellipse cx="40" cy="66" rx="25" ry="4.5" fill={url.shadow} />
      <rect x="16" y="20" width="48" height="43" rx="7" fill="#B7C7DA" />
      <rect x="16" y="17" width="48" height="43" rx="7" fill={url.paper} />
      <path d="M23 17 H57 A7 7 0 0 1 64 24 V29 H16 V24 A7 7 0 0 1 23 17Z" fill="#24456B" />
      <path d="M23 17 H57 A7 7 0 0 1 64 24 V25 H16 V24 A7 7 0 0 1 23 17Z" fill="#FFFFFF" fillOpacity="0.14" />
      <rect x="25" y="12" width="4.5" height="10" rx="2.25" fill="#3D5F86" />
      <rect x="50.5" y="12" width="4.5" height="10" rx="2.25" fill="#3D5F86" />
      <g fill="#DADDD7">
        <circle cx="24" cy="36" r="1.7" />
        <circle cx="32" cy="36" r="1.7" />
        <circle cx="40" cy="36" r="1.7" />
        <circle cx="48" cy="36" r="1.7" />
        <circle cx="56" cy="36" r="1.7" />
        <circle cx="24" cy="52" r="1.7" />
        <circle cx="32" cy="52" r="1.7" />
        <circle cx="40" cy="52" r="1.7" />
        <circle cx="48" cy="52" r="1.7" />
        <circle cx="56" cy="52" r="1.7" />
        <circle cx="24" cy="44" r="1.7" />
        <circle cx="56" cy="44" r="1.7" />
      </g>
      <g className="ei-grow">
        <rect x="29" y="40.5" width="23" height="7" rx="3.5" fill="#7FA9DC" />
        <rect x="29" y="40.5" width="23" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.35" />
        <circle cx="32.5" cy="44" r="2" fill={url.gold} />
      </g>
    </svg>
  );
}
