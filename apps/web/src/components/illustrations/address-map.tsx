import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs } from './defs';

/**
 * A drawn street map with a pin in the middle, for the top of the address card. Decorative and the same for every
 * property: it isn't a real map, so no map service is called and nothing about the address leaves the app. It fills its
 * box (cropping the edges, never stretching), and the pin stays centred.
 */
export function AddressMap({ className }: { className?: string }) {
  const { id, url } = useIllustrationIds();
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" aria-hidden className={className}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen']} />
      {/* Land, a bay along the bottom left and a park on the right */}
      <rect width="400" height="120" fill="#EDF1EA" />
      <path d="M0 78 C40 70 70 92 112 88 C150 84 160 104 196 120 L0 120 Z" fill="#DCE8F5" />
      <path
        d="M20 98 q6 -3 12 0 t12 0 M70 106 q6 -3 12 0 t12 0 M120 103 q5 -2.5 10 0 t10 0"
        fill="none"
        stroke="#B9D0EA"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M292 8 C320 2 360 10 368 30 C376 50 344 60 318 54 C292 48 270 22 292 8 Z" fill="#D3E6D7" />
      <circle cx="312" cy="26" r="5" fill="#B5D4BD" />
      <circle cx="332" cy="38" r="6" fill="#B5D4BD" />
      <circle cx="348" cy="24" r="4" fill="#B5D4BD" />
      {/* Blocks */}
      <g fill="#F7F8F4" stroke="#E1E5DD" strokeWidth="1">
        <rect x="18" y="12" width="64" height="36" rx="5" />
        <rect x="100" y="12" width="70" height="36" rx="5" />
        <rect x="100" y="62" width="70" height="14" rx="4" />
        <rect x="230" y="12" width="44" height="36" rx="5" />
        <rect x="230" y="62" width="76" height="40" rx="5" />
        <rect x="324" y="72" width="60" height="34" rx="5" />
        <rect x="18" y="58" width="44" height="12" rx="4" />
      </g>
      {/* Streets */}
      <g fill="none" stroke="#FFFFFF" strokeLinecap="round">
        <path d="M0 55 H400" strokeWidth="9" />
        <path d="M91 0 V82" strokeWidth="7" />
        <path d="M200 0 V120" strokeWidth="9" />
        <path d="M315 60 V120" strokeWidth="7" />
        <path d="M200 55 L280 0" strokeWidth="6" />
      </g>
      <g fill="none" stroke="#E1E5DD" strokeWidth="1" strokeDasharray="5 6">
        <path d="M0 55 H190 M210 55 H400" />
        <path d="M200 0 V45 M200 65 V120" />
      </g>
      {/* The pin, with a soft ring around where it lands */}
      <ellipse cx="200" cy="74" rx="22" ry="7" fill="#4F7A63" opacity="0.14" />
      <ellipse cx="200" cy="74" rx="9" ry="3" fill={url.shadow} />
      <path
        d="M200 74 C200 74 186 58 186 47 A14 14 0 1 1 214 47 C214 58 200 74 200 74 Z"
        transform="translate(1.4 1.6)"
        fill="#2F5548"
      />
      <path d="M200 74 C200 74 186 58 186 47 A14 14 0 1 1 214 47 C214 58 200 74 200 74 Z" fill="#4F7A63" />
      <path d="M200 74 C200 74 186 58 186 47 A14 14 0 1 1 214 47 C214 58 200 74 200 74 Z" fill={url.sheen} />
      <circle cx="200" cy="47" r="5.4" fill="#FFFFFF" />
      <circle cx="200" cy="47" r="2.6" fill="#D9AE3C" />
    </svg>
  );
}
