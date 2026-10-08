import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/** No receipts: a paper receipt with a gold seal (docs/design/EmptyIcons.dc.html). */
export function ReceiptsIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A paper receipt with a gold seal"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'gold', 'paper']} />
      <circle cx="40" cy="40" r="35" fill="#E6E0F5" />
      <ellipse cx="38" cy="66" rx="22" ry="4.5" fill={url.shadow} />
      <path
        d="M25 15 H53 A4 4 0 0 1 57 19 V62 L53 59 L49 62 L45 59 L41 62 L37 59 L33 62 L29 59 L25 62 L23 60.5 V19 A4 4 0 0 1 25 15Z"
        fill="#CFC8E4"
        transform="translate(2 2)"
      />
      <path
        d="M25 15 H53 A4 4 0 0 1 57 19 V62 L53 59 L49 62 L45 59 L41 62 L37 59 L33 62 L29 59 L25 62 L21 59 V19 A4 4 0 0 1 25 15Z"
        fill={url.paper}
      />
      <rect x="27" y="23" width="22" height="3" rx="1.5" fill="#56478A" fillOpacity="0.75" />
      <rect x="27" y="31" width="16" height="2.5" rx="1.25" fill="#DADDD7" />
      <rect x="27" y="37" width="20" height="2.5" rx="1.25" fill="#DADDD7" />
      <rect x="27" y="43" width="13" height="2.5" rx="1.25" fill="#DADDD7" />
      <rect x="27" y="50" width="12" height="3" rx="1.5" fill="#A99BD6" />
      <g className="ei-stamp">
        <circle cx="54" cy="52" r="10" fill="#C99A2E" />
        <circle cx="53" cy="50" r="10" fill={url.gold} />
        <path
          d="M48.5 50 L51.5 53 L57.5 46.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
