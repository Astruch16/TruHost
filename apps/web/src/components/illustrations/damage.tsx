import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/** Damage: a framed picture with a crack across its glass, on rose (docs/design/EmptyIcons style). */
export function DamageIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A framed picture with cracked glass"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="40" cy="40" r="35" fill="#FBE2EA" />
      <ellipse cx="40" cy="66" rx="21" ry="4" fill={url.shadow} />
      {/* hanging wire */}
      <path d="M28 22 L40 13 L52 22" fill="none" stroke="#8C7646" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="40" cy="13" r="2.2" fill={url.gold} />
      {/* frame */}
      <rect x="17" y="23.5" width="46" height="38" rx="3" fill="#6E4A1F" />
      <rect x="17" y="22" width="46" height="38" rx="3" fill={url.gold} />
      {/* picture: sky, hills, sun */}
      <rect x="22" y="27" width="36" height="28" rx="1.5" fill="#BFD6EE" />
      <circle cx="49" cy="34" r="3.5" fill="#F2D987" />
      <path d="M22 55 L22 45 L31 38 L38 44 L45 39 L58 48 L58 55 Z" fill="#4F7A63" />
      <path d="M22 55 L22 49 L33 45 L43 50 L58 47 L58 55 Z" fill="#2F5548" />
      <rect x="22" y="27" width="36" height="28" rx="1.5" fill={url.sheen} />
      {/* the crack */}
      <path
        d="M34 27 L37.5 34 L33.5 38.5 L39 44 L36.5 49.5 L41 55"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M37.5 34 L43 35.5 M39 44 L44.5 42.5" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M58 30 L53 32" stroke="#8B2350" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** A damage report in the bell: the cracked frame, small, on rose. 40×40, decorative. */
export function DamageAlertIcon({ size = 40, className }: { size?: number; className?: string }) {
  const { id, url } = useIllustrationIds();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={className}>
      <IllustrationDefs ids={id} use={['shadow', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#FBE2EA" />
      <ellipse cx="20" cy="32.5" rx="10.5" ry="2" fill={url.shadow} />
      <rect x="8.5" y="11" width="23" height="19" rx="1.8" fill="#6E4A1F" />
      <rect x="8.5" y="10" width="23" height="19" rx="1.8" fill={url.gold} />
      <rect x="11" y="12.5" width="18" height="14" rx="1" fill="#BFD6EE" />
      <path d="M11 26.5 V21.5 L16 18 L19.5 21 L23 18.5 L29 23 V26.5 Z" fill="#4F7A63" />
      <path
        d="M17 12.5 L19 16.5 L16.8 19 L19.5 22 L18.2 26.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
