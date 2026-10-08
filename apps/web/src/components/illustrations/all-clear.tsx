import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

const SHIELD = 'M40 14 L60 22 V37 C60 50 51 58.5 40 64 C29 58.5 20 50 20 37 V22Z';

/** Nothing needs attention: a green shield with a check mark (docs/design/EmptyIcons.dc.html). */
export function AllClearIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A green shield with a check mark"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="40" cy="40" r="35" fill="#DDEBDF" />
      <ellipse cx="40" cy="67" rx="20" ry="4" fill={url.shadow} />
      <g className="ei-float">
        <path d={SHIELD} fill="#2F5548" transform="translate(1.5 2)" />
        <path d={SHIELD} fill="#4F7A63" />
        <path
          d="M40 19 L55 25 V37 C55 47 48.5 53.5 40 58 C31.5 53.5 25 47 25 37 V25Z"
          fill="#93BFA0"
          fillOpacity="0.45"
        />
        <path d={SHIELD} fill={url.sheen} />
        <path
          d="M31.5 38.5 L37.5 44.5 L49 32"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        className="ei-twinkle"
        d="M62 12 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6z"
        fill={url.gold}
      />
      <path
        className="ei-twinkle"
        style={{ animationDelay: '-1.2s' }}
        d="M16 50 l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1z"
        fill={url.gold}
      />
    </svg>
  );
}
