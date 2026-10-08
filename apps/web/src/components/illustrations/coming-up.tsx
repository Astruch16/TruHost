import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/** Nothing coming up: a cabin door with a welcome mat (docs/design/EmptyIcons.dc.html). */
export function ComingUpIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A cabin door with a welcome mat"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="40" cy="40" r="35" fill="#F1ECDD" />
      <ellipse cx="40" cy="66" rx="25" ry="4.5" fill={url.shadow} />
      <path
        d="M18 22 L40 10 L62 22"
        fill="none"
        stroke="#3E6B56"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="24" y="20" width="32" height="42" rx="4" fill="#553B30" />
      <rect x="27" y="23" width="26" height="39" rx="2.5" fill="#6B4E3D" />
      <rect x="27" y="23" width="26" height="39" rx="2.5" fill={url.sheen} />
      <rect x="31" y="27" width="18" height="13" rx="2" fill="#553B30" fillOpacity="0.55" />
      <rect x="31" y="44" width="18" height="14" rx="2" fill="#553B30" fillOpacity="0.55" />
      <rect className="ei-glow" x="33" y="29" width="14" height="9" rx="1.5" fill="#E2C15A" fillOpacity="0.85" />
      <path d="M40 29 V38 M33 33.5 H47" stroke="#553B30" strokeWidth="1.2" />
      <circle cx="47.5" cy="43" r="2.2" fill={url.gold} />
      <rect x="19" y="61" width="42" height="5" rx="2.5" fill="#93BFA0" />
      <rect x="19" y="61" width="42" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.35" />
    </svg>
  );
}
