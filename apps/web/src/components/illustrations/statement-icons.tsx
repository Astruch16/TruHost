import { useIllustrationIds } from '../../lib/illustration-ids';
import { IllustrationDefs } from './defs';

/**
 * Small icons for the owner's month statement, drawn like the empty state illustrations (docs/design/EmptyIcons.dc.html):
 * a tinted disc, a soft shadow, shapes with a darker copy beneath for depth, a sheen and gold accents. Static (no
 * motion) at this size. Drawn on a 40×40 grid; 40px by default. Decorative: the line's label says what it is.
 */
interface StatementIconProps {
  size?: number;
  className?: string;
}

function Frame({ size = 40, className, children }: StatementIconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={className}>
      {children}
    </svg>
  );
}

/** Gross revenue: a banknote with a gold coin, on sage. */
export function GrossIcon(props: StatementIconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <Frame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="20" cy="32.5" rx="12" ry="2.2" fill={url.shadow} />
      <rect x="7" y="13.5" width="22" height="13" rx="2.5" fill="#2F5548" />
      <rect x="7" y="12" width="22" height="13" rx="2.5" fill="#4F7A63" />
      <rect
        x="9.5"
        y="14.5"
        width="17"
        height="8"
        rx="1.5"
        fill="none"
        stroke="#DDEBDF"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
      <circle cx="18" cy="18.5" r="2.6" fill="#DDEBDF" fillOpacity="0.8" />
      <rect x="7" y="12" width="22" height="13" rx="2.5" fill={url.sheen} />
      <circle cx="28.5" cy="26.5" r="6" fill="#C99A2E" />
      <circle cx="28" cy="25.3" r="6" fill={url.gold} />
      <circle cx="28" cy="25.3" r="3.6" fill="none" stroke="#C99A2E" strokeWidth="1.1" />
      <path
        d="M24.4 22.6 A4.6 4.6 0 0 1 26.9 20.6"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </Frame>
  );
}

/** Management fee: a price tag with a percent sign, on lavender. */
export function FeeIcon(props: StatementIconProps) {
  const { id, url } = useIllustrationIds();
  const tag = 'M12.5 12 H27 A2.5 2.5 0 0 1 29.5 14.5 V24.5 A2.5 2.5 0 0 1 27 27 H12.5 L7 19.5 Z';
  return (
    <Frame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen']} />
      <circle cx="20" cy="20" r="19" fill="#E6E0F5" />
      <ellipse cx="19" cy="32.5" rx="11.5" ry="2.2" fill={url.shadow} />
      <path d={tag} transform="translate(0 1.6)" fill="#3F3470" />
      <path d={tag} fill="#6E5DB0" />
      <circle cx="12.6" cy="19.5" r="1.7" fill="#E6E0F5" />
      <path d={tag} fill={url.sheen} />
      {/* % */}
      <circle cx="18.6" cy="16.6" r="1.5" fill="none" stroke="#FFFFFF" strokeWidth="1.3" />
      <circle cx="24.4" cy="22.4" r="1.5" fill="none" stroke="#FFFFFF" strokeWidth="1.3" />
      <path d="M24.6 15.8 L18.4 23.2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
    </Frame>
  );
}

/** No fee on an own property: a little house with a gold door, on sage. */
export function OwnPropertyIcon(props: StatementIconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <Frame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="20" cy="32.5" rx="12" ry="2.2" fill={url.shadow} />
      <rect x="11" y="18.5" width="18" height="12" rx="1.5" fill="#C9CEC6" />
      <rect x="11" y="17.5" width="18" height="12" rx="1.5" fill={url.paper} />
      <path d="M8.5 19 L20 9.5 L31.5 19 Z" transform="translate(0 1.2)" fill="#2F5548" />
      <path d="M8.5 19 L20 9.5 L31.5 19 Z" fill="#4F7A63" />
      <path d="M8.5 19 L20 9.5 L31.5 19 Z" fill={url.sheen} />
      <rect x="17.6" y="22" width="4.8" height="7.5" rx="1" fill={url.gold} />
      <circle cx="21.2" cy="25.8" r="0.6" fill="#8A6A1C" />
      <rect x="23.6" y="20.5" width="3.4" height="3" rx="0.6" fill="#BFD6EE" />
    </Frame>
  );
}

/** Expenses: a receipt with a gold coin, on amber. */
export function ExpensesIcon(props: StatementIconProps) {
  const { id, url } = useIllustrationIds();
  const receipt = 'M11 8.5 H26 V30 L23.5 28.3 L21 30 L18.5 28.3 L16 30 L13.5 28.3 L11 30 Z';
  return (
    <Frame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#FBEECB" />
      <ellipse cx="19" cy="33" rx="11" ry="2.2" fill={url.shadow} />
      <path d={receipt} transform="translate(1 1.2)" fill="#D9C9A0" />
      <path d={receipt} fill={url.paper} />
      <path d={receipt} fill="none" stroke="#E6D9B8" strokeWidth="0.8" />
      <path d="M14 13 H23 M14 16.5 H21 M14 20 H22.5" stroke="#C8B78A" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="27.5" cy="25.5" r="5.5" fill="#C99A2E" />
      <circle cx="27" cy="24.4" r="5.5" fill={url.gold} />
      <circle cx="27" cy="24.4" r="3.3" fill="none" stroke="#C99A2E" strokeWidth="1" />
      <path
        d="M23.7 21.9 A4.2 4.2 0 0 1 26 20.1"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </Frame>
  );
}
