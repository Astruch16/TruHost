import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/**
 * Nothing coming up: a log cabin waiting for its next guests, the same cabin as the property cards' scene. A green
 * gabled roof with a smoking chimney, log walls, a lit window, an arched door with a lit pane and a gold knob, a wall
 * lantern, a stone step and a mat. The door's pane and the lantern glow gently (`ei-glow`; still under reduced motion).
 */
export function ComingUpIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A log cabin with a lit lantern by the door"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="40" cy="40" r="35" fill="#F1ECDD" />
      <ellipse cx="40" cy="65.5" rx="26" ry="4.5" fill={url.shadow} />

      {/* Chimney and a curl of smoke, behind the roof */}
      <path
        d="M53.5 12.5 c-2 -1.6 1.4 -2.6 0 -4.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
      <rect x="50" y="15" width="6.5" height="12" rx="1" fill="#7C8381" />
      <rect x="49" y="13.5" width="8.5" height="3" rx="1" fill="#646B69" />

      {/* Log walls, lit from the top left */}
      <rect x="20" y="30" width="40" height="33" rx="2.5" fill="#8A5A3B" />
      <path d="M20 38 H60 M20 45 H60 M20 52 H60 M20 59 H60" stroke="#6F4630" strokeWidth="1.3" />
      <rect x="20" y="30" width="40" height="33" rx="2.5" fill={url.sheen} />
      {/* The eave's shadow on the wall */}
      <rect x="20" y="34.5" width="40" height="2.5" fill="#3B2419" fillOpacity="0.28" />

      {/* Roof with an overhang, its left face catching the light */}
      <path d="M12.5 33 L40 12 L67.5 33 C68.3 33.7 67.8 35 66.7 35 H13.3 C12.2 35 11.7 33.7 12.5 33 Z" fill="#3E6B56" />
      <path
        d="M12.5 33 L40 12 L40 17.5 L17.5 35 H13.3 C12.2 35 11.7 33.7 12.5 33 Z"
        fill="#FFFFFF"
        fillOpacity="0.14"
      />

      {/* Window */}
      <rect x="23" y="40.5" width="8" height="8" rx="1.2" fill="#4A3127" />
      <rect x="24" y="41.5" width="6" height="6" rx="0.8" fill="#F2D987" />
      <path d="M27 41.5 V47.5 M24 44.5 H30" stroke="#4A3127" strokeWidth="1" />

      {/* Arched door, a lit pane and a gold knob */}
      <path d="M33 63 V47 A7 7 0 0 1 47 47 V63 Z" fill="#4A3127" />
      <path d="M35 63 V47.5 A5 5 0 0 1 45 47.5 V63 Z" fill="#6B4E3D" />
      <path d="M35 63 V47.5 A5 5 0 0 1 45 47.5 V63 Z" fill={url.sheen} />
      <path className="ei-glow" d="M37 48.5 A3 3 0 0 1 43 48.5 V51 H37 Z" fill="#F2D987" />
      <circle cx="43" cy="56.5" r="1.4" fill={url.gold} />

      {/* Wall lantern under its cap, with its glow */}
      <g className="ei-glow">
        <circle cx="53.5" cy="47.5" r="5.5" fill="#F2D987" fillOpacity="0.3" />
        <rect x="51" y="44.5" width="5" height="6.5" rx="1.2" fill={url.gold} />
      </g>
      <rect x="50.5" y="43" width="6" height="2" rx="1" fill="#3B2419" />

      {/* Stone step and mat */}
      <rect x="30" y="62" width="20" height="2.5" rx="1.25" fill="#C9C2B0" />
      <rect x="31.5" y="63.5" width="17" height="3.5" rx="1.75" fill="#93BFA0" />
      <rect x="31.5" y="63.5" width="17" height="1.4" rx="0.7" fill="#FFFFFF" fillOpacity="0.4" />
    </svg>
  );
}
