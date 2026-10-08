import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs, type IllustrationProps } from './defs';

/** No expenses: a green wallet with a card tucked inside (docs/design/EmptyIcons.dc.html). */
export function ExpensesIllustration({ size = 88, className }: IllustrationProps) {
  const { id, url } = useIllustrationIds();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label="A green wallet with a card tucked inside"
      className={className}
    >
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="40" cy="40" r="35" fill="#DDEBDF" />
      <ellipse cx="40" cy="65" rx="26" ry="4.5" fill={url.shadow} />
      <g className="ei-peek">
        <g transform="rotate(-12 40 26)">
          <rect x="24" y="14" width="32" height="21" rx="3.5" fill="#8B7FD0" />
          <rect x="24" y="19" width="32" height="4" fill="#56478A" fillOpacity="0.6" />
          <rect x="28" y="27" width="10" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        </g>
      </g>
      <rect x="14" y="28" width="52" height="33" rx="9" fill="#2F5548" />
      <rect x="14" y="26" width="52" height="33" rx="9" fill="#4F7A63" />
      <rect x="14" y="26" width="52" height="33" rx="9" fill={url.sheen} />
      <path d="M22 29 H58" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="46" y="36" width="22" height="14" rx="7" fill="#2F5548" />
      <circle cx="55" cy="43" r="3.4" fill={url.gold} />
    </svg>
  );
}
