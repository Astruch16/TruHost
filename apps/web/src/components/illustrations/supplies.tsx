import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/** Supplies, nothing tracked yet: a roll of toilet paper beside a pump bottle, on blue (docs/design/EmptyIcons). */
export function SuppliesIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  const bottle =
    'M48 36 H62 A3.5 3.5 0 0 1 65.5 39.5 V58.5 A3.5 3.5 0 0 1 62 62 H48 A3.5 3.5 0 0 1 44.5 58.5 V39.5 A3.5 3.5 0 0 1 48 36 Z';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A roll of toilet paper and a soap bottle"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="40" cy="40" r="35" fill="#DCE8F5" />
      <ellipse cx="40" cy="66" rx="24" ry="4" fill={url.shadow} />
      {/* pump bottle */}
      <rect x="52.5" y="25" width="5" height="11.5" rx="1" fill="#3F3470" />
      <path d="M49 25 H60.5 A1.5 1.5 0 0 1 62 26.5 V27.5 H49 Z" fill="#3F3470" />
      <path d="M49 23.5 H60 A1.5 1.5 0 0 1 61.5 25 V26 H49 Z" fill="#6E5DB0" />
      <path d={bottle} transform="translate(0 1.6)" fill="#3F3470" />
      <path d={bottle} fill="#6E5DB0" />
      <rect x="47.5" y="43" width="15" height="10" rx="1.6" fill="#FFFFFF" fillOpacity="0.85" />
      <path d="M50.5 46.5 H59.5 M50.5 49.5 H57" stroke="#B9B0DA" strokeWidth="1.3" strokeLinecap="round" />
      <path d={bottle} fill={url.sheen} />
      {/* toilet roll */}
      <path d="M14 33 V58 A13 5 0 0 0 40 58 V33 Z" fill="#C9CEC6" transform="translate(1 1.4)" />
      <path d="M14 33 V58 A13 5 0 0 0 40 58 V33 Z" fill={url.paper} />
      <path d="M14 47 V56 C17 58 21 59 24 59 V50 C21 50 17 49 14 47 Z" fill="#FFFFFF" />
      <path d="M14 47 V56 C17 58 21 59 24 59 V50 C21 50 17 49 14 47 Z" fill="none" stroke="#E2E4DF" strokeWidth="0.8" />
      <ellipse cx="27" cy="33" rx="13" ry="5" fill="#F3F4F0" />
      <ellipse cx="27" cy="33" rx="13" ry="5" fill="none" stroke="#E2E4DF" strokeWidth="0.8" />
      <ellipse cx="27" cy="33" rx="4.6" ry="1.9" fill="#B9A06A" />
      <ellipse cx="27" cy="33.4" rx="3.4" ry="1.2" fill="#8C7646" />
      {/* a gold sparkle */}
      <path d="M66 17 L67.4 20.6 L71 22 L67.4 23.4 L66 27 L64.6 23.4 L61 22 L64.6 20.6 Z" fill={url.gold} />
    </svg>
  );
}

/**
 * A supply alert in the bell: a roll of toilet paper on amber (running low) or rose (run out), with a small gauge.
 * 40×40, decorative (the alert's title says what it is).
 */
export function SupplyAlertIcon({ out, size = 40, className }: { out: boolean; size?: number; className?: string }) {
  const { id, url } = useIllustrationIds();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={className}>
      <IllustrationDefs ids={id} use={['shadow', 'paper']} />
      <circle cx="20" cy="20" r="19" fill={out ? '#F8E1DE' : '#FBEECB'} />
      <ellipse cx="18" cy="32.5" rx="10" ry="2" fill={url.shadow} />
      <path d="M9 15 V28 A7 2.6 0 0 0 23 28 V15 Z" fill="#C9CEC6" transform="translate(0.8 1)" />
      <path d="M9 15 V28 A7 2.6 0 0 0 23 28 V15 Z" fill={url.paper} />
      <ellipse cx="16" cy="15" rx="7" ry="2.6" fill="#F3F4F0" stroke="#E2E4DF" strokeWidth="0.6" />
      <ellipse cx="16" cy="15" rx="2.4" ry="1" fill="#8C7646" />
      {/* gauge */}
      <rect x="26" y="11" width="5" height="18" rx="2.5" fill="#FFFFFF" stroke={out ? '#E6B3AD' : '#E9D59E'} />
      <rect
        x="27.2"
        y={out ? 26.6 : 22}
        width="2.6"
        height={out ? 1.2 : 5.8}
        rx="1.2"
        fill={out ? '#C4473B' : '#D29A2A'}
      />
    </svg>
  );
}
