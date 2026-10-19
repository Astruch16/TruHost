import { useIllustrationIds } from '../../lib/illustration-ids';
import { IconFrame, IllustrationDefs, type IconProps } from './defs';
import { CleaningIcon, ExpensesIcon } from './statement-icons';

/**
 * One small icon per expense category, drawn like the empty state illustrations (docs/design/EmptyIcons.dc.html): a
 * tinted disc, a soft shadow, shapes with a darker copy beneath for depth, a sheen and gold accents. 40×40 grid.
 */

/** Supplies: a kraft box, taped, with a paper label, on amber. */
export function SuppliesIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#FBEECB" />
      <ellipse cx="20" cy="32.6" rx="12" ry="2.2" fill={url.shadow} />
      <rect x="10" y="17.6" width="20" height="13.4" rx="1.6" fill="#A9773E" />
      <rect x="10" y="16.2" width="20" height="13.4" rx="1.6" fill="#D9A86C" />
      <rect x="8.8" y="13.6" width="22.4" height="5" rx="1.3" fill="#A9773E" />
      <rect x="8.8" y="12.4" width="22.4" height="5" rx="1.3" fill="#E7BC80" />
      <rect x="18.4" y="12.4" width="3.2" height="17.2" fill="#F4E4C1" fillOpacity="0.9" />
      <rect x="12.2" y="21.4" width="4.8" height="4" rx="0.6" fill={url.paper} />
      <path d="M13.2 22.9 H16 M13.2 24.2 H15" stroke="#C8B78A" strokeWidth="0.7" strokeLinecap="round" />
      <rect x="8.8" y="12.4" width="22.4" height="17.2" rx="1.6" fill={url.sheen} />
    </IconFrame>
  );
}

/** Repairs and maintenance: a steel wrench with a gold grip, on blue. */
export function RepairsIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  const notch = <rect x="17.9" y="4.2" width="4.2" height="7.6" rx="0.8" fill="#DCE8F5" />;
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#DCE8F5" />
      <ellipse cx="19" cy="32.8" rx="11" ry="2.1" fill={url.shadow} />
      <g transform="translate(0 1.4) rotate(45 20 20)" fill="#2E4F73">
        <rect x="17.7" y="14" width="4.6" height="18" rx="2.3" />
        <circle cx="20" cy="12" r="6" />
        {notch}
      </g>
      <g transform="rotate(45 20 20)">
        <rect x="17.7" y="14" width="4.6" height="18" rx="2.3" fill="#5B87B8" />
        <circle cx="20" cy="12" r="6" fill="#5B87B8" />
        <rect x="17.7" y="21" width="4.6" height="11" rx="2.3" fill={url.gold} />
        <path d="M17.7 23.2 H22.3 M17.7 25.4 H22.3" stroke="#C99A2E" strokeWidth="0.6" />
        {notch}
        <circle cx="20" cy="12" r="6" fill={url.sheen} />
        <circle cx="20" cy="29.4" r="0.9" fill="#8A6A1C" />
      </g>
    </IconFrame>
  );
}

/** Subscriptions: a screen playing something, on a gold stand, on lavender. */
export function SubscriptionsIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#E6E0F5" />
      <ellipse cx="20" cy="32.6" rx="10" ry="2" fill={url.shadow} />
      <rect x="18.5" y="25.5" width="3" height="4" fill="#3F3470" />
      <rect x="14.5" y="29.6" width="11" height="1.8" rx="0.9" fill="#8A6A1C" />
      <rect x="14.5" y="28.9" width="11" height="1.8" rx="0.9" fill={url.gold} />
      <rect x="8.5" y="12.2" width="23" height="15.6" rx="2.4" fill="#3F3470" />
      <rect x="8.5" y="10.8" width="23" height="15.6" rx="2.4" fill="#56478A" />
      <rect x="10.4" y="12.7" width="19.2" height="11.8" rx="1.2" fill="#6E5DB0" />
      <path d="M18 15.3 L23.4 18.4 L18 21.5 Z" fill="#FFFFFF" />
      <rect x="12.4" y="22.4" width="15.2" height="0.9" rx="0.45" fill="#FFFFFF" fillOpacity="0.3" />
      <rect x="12.4" y="22.4" width="6" height="0.9" rx="0.45" fill="#F2D987" />
      <rect x="8.5" y="10.8" width="23" height="15.6" rx="2.4" fill={url.sheen} />
    </IconFrame>
  );
}

/** Utilities: a lit bulb, on amber. */
export function UtilitiesIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  const bulb = 'M17.3 25 C17.3 23.6 16.4 22.7 15.24 21.9 A7.2 7.2 0 1 1 24.76 21.9 C23.6 22.7 22.7 23.6 22.7 25 Z';
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#FBEECB" />
      <ellipse cx="20" cy="33" rx="7" ry="1.8" fill={url.shadow} />
      <path
        d="M20 5.6 V7.4 M11.6 9.2 L12.9 10.5 M28.4 9.2 L27.1 10.5 M8.6 16.6 H10.4 M31.4 16.6 H29.6"
        stroke="#C99A2E"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d={bulb} transform="translate(0.7 0.9)" fill="#C99A2E" />
      <path d={bulb} fill={url.gold} />
      <path
        d="M18.3 24.8 V20 Q18.3 17.6 20 17.6 Q21.7 17.6 21.7 20 V24.8"
        fill="none"
        stroke="#A87A18"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d="M15.2 15.2 A4.8 4.8 0 0 1 18.2 11.4"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.8"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect x="17" y="25.4" width="6" height="4.4" rx="1" fill="#6B6E68" />
      <rect x="17" y="24.8" width="6" height="4.4" rx="1" fill="#A3A79F" />
      <path d="M17 26.3 H23 M17 27.8 H23" stroke="#7C7F78" strokeWidth="0.7" />
      <path d="M18.5 29.2 H21.5 L20.8 30.6 H19.2 Z" fill="#55584F" />
    </IconFrame>
  );
}

/** Internet: a router under the wifi arcs, on blue. */
export function InternetIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#DCE8F5" />
      <ellipse cx="20" cy="33" rx="11.5" ry="2" fill={url.shadow} />
      <path d="M12.9 13.9 A10 10 0 0 1 27.1 13.9" fill="none" stroke="#7FA9DC" strokeWidth="2" strokeLinecap="round" />
      <path d="M15.8 16.8 A6 6 0 0 1 24.2 16.8" fill="none" stroke="#3D5F86" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="20.6" r="1.8" fill={url.gold} />
      <rect x="9.5" y="25.4" width="21" height="6.4" rx="2.2" fill="#2E4F73" />
      <rect x="9.5" y="24.2" width="21" height="6.4" rx="2.2" fill="#3D5F86" />
      <circle cx="13.4" cy="27.4" r="0.9" fill="#93BFA0" />
      <circle cx="16.2" cy="27.4" r="0.9" fill="#F2D987" />
      <path d="M21.5 27.4 H27" stroke="#2E4F73" strokeWidth="0.9" strokeLinecap="round" />
      <rect x="9.5" y="24.2" width="21" height="6.4" rx="2.2" fill={url.sheen} />
    </IconFrame>
  );
}

/** Furnishings: a tufted armchair on gold legs, on sage. */
export function FurnishingsIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="20" cy="32.8" rx="12" ry="2" fill={url.shadow} />
      <rect x="11.2" y="27.6" width="1.8" height="3.6" rx="0.6" fill={url.gold} />
      <rect x="27" y="27.6" width="1.8" height="3.6" rx="0.6" fill={url.gold} />
      <rect x="11.5" y="12.5" width="17" height="12" rx="3.5" fill="#2F5548" />
      <rect x="11.5" y="11.3" width="17" height="12" rx="3.5" fill="#4F7A63" />
      <circle cx="17" cy="16" r="0.7" fill="#2F5548" />
      <circle cx="23" cy="16" r="0.7" fill="#2F5548" />
      <rect x="10" y="24.4" width="20" height="4" rx="1.4" fill="#2F5548" />
      <rect x="12.6" y="20.6" width="14.8" height="4.8" rx="1.6" fill="#93BFA0" />
      <rect x="8.5" y="18.6" width="5.2" height="10.4" rx="2.4" fill="#2F5548" />
      <rect x="26.3" y="18.6" width="5.2" height="10.4" rx="2.4" fill="#2F5548" />
      <rect x="8.5" y="17.6" width="5.2" height="10.2" rx="2.4" fill="#4F7A63" />
      <rect x="26.3" y="17.6" width="5.2" height="10.2" rx="2.4" fill="#4F7A63" />
      <rect x="8.5" y="11.3" width="23" height="17" rx="3.5" fill={url.sheen} />
    </IconFrame>
  );
}

/** Licensing and permits: a certificate with a gold seal and ribbon, on lavender. */
export function LicensingIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#E6E0F5" />
      <ellipse cx="20" cy="33" rx="11.5" ry="2.1" fill={url.shadow} />
      <rect x="8.5" y="10" width="21" height="17" rx="1.8" transform="translate(1 1.2)" fill="#CFC8E0" />
      <rect x="8.5" y="10" width="21" height="17" rx="1.8" fill={url.paper} />
      <rect x="8.5" y="10" width="21" height="17" rx="1.8" fill="none" stroke="#DDD6EC" strokeWidth="0.8" />
      <path d="M12 14.2 H26" stroke="#6E5DB0" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 17.8 H23.5 M12 21 H19.5" stroke="#B9AFD3" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M25.6 26 L24 31.6 L26 30.8 L27.2 32.4 L28.4 26.6 Z" fill="#56478A" />
      <path d="M28.6 26.4 L29.8 32.2 L30.9 30.4 L32.9 31 L30.6 25.6 Z" fill="#6E5DB0" />
      <circle cx="28.4" cy="24.4" r="4.6" fill="#C99A2E" />
      <circle cx="28" cy="23.5" r="4.6" fill={url.gold} />
      <circle cx="28" cy="23.5" r="2.8" fill="none" stroke="#C99A2E" strokeWidth="0.9" />
      <path
        d="M25.1 21.6 A3.6 3.6 0 0 1 27.1 20"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </IconFrame>
  );
}

/** Insurance: a blue shield with a check, on blue. */
export function InsuranceIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  const shield = 'M20 8.5 L29 11.8 V19 Q29 26.5 20 31 Q11 26.5 11 19 V11.8 Z';
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen']} />
      <circle cx="20" cy="20" r="19" fill="#DCE8F5" />
      <ellipse cx="20" cy="33.2" rx="9" ry="1.9" fill={url.shadow} />
      <path d={shield} transform="translate(0 1.4)" fill="#2E4F73" />
      <path d={shield} fill="#5B87B8" />
      <path d="M20 8.5 V31 Q11 26.5 11 19 V11.8 Z" fill="#FFFFFF" fillOpacity="0.12" />
      <path d={shield} fill={url.sheen} />
      <path
        d="M15.8 19.6 L18.8 22.6 L24.4 16.6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

/** Strata: an apartment building with lit windows and a gold door, on grey. */
export function StrataIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  const windows = [15.2, 18.9, 22.6].flatMap((x, c) =>
    [12.6, 16.2, 19.8, 23.4].map((y, r) => ({ x, y, lit: (c === 0 && r === 1) || (c === 2 && r === 2) })),
  );
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#E2E4DF" />
      <ellipse cx="20" cy="32.6" rx="12" ry="2.1" fill={url.shadow} />
      <rect x="8.4" y="19" width="6" height="12" rx="1" fill="#C9CEC6" />
      <path d="M10 22 H12.6 M10 25 H12.6 M10 28 H12.6" stroke="#BFD6EE" strokeWidth="1.4" />
      <rect x="13" y="9.2" width="14" height="22" rx="1.5" transform="translate(1 1)" fill="#C9CEC6" />
      <rect x="13" y="9.2" width="14" height="22" rx="1.5" fill={url.paper} />
      <rect x="13" y="9.2" width="14" height="22" rx="1.5" fill="none" stroke="#DADDD7" strokeWidth="0.7" />
      <rect x="12.2" y="8.6" width="15.6" height="2.4" rx="1" transform="translate(0 0.8)" fill="#2F5548" />
      <rect x="12.2" y="8.6" width="15.6" height="2.4" rx="1" fill="#4F7A63" />
      {windows.map((w) => (
        <rect
          key={`${w.x}-${w.y}`}
          x={w.x}
          y={w.y}
          width="2.4"
          height="2.4"
          rx="0.4"
          fill={w.lit ? '#F2D987' : '#BFD6EE'}
        />
      ))}
      <rect x="18.2" y="27.2" width="3.6" height="4" rx="0.6" fill={url.gold} />
    </IconFrame>
  );
}

/** The icon for an expense category; anything unknown gets the receipt. */
export function ExpenseCategoryIcon({ category, ...props }: IconProps & { category: string | null }) {
  switch (category) {
    case 'SUPPLIES':
      return <SuppliesIcon {...props} />;
    case 'REPAIRS_MAINTENANCE':
      return <RepairsIcon {...props} />;
    case 'SUBSCRIPTIONS':
      return <SubscriptionsIcon {...props} />;
    case 'UTILITIES':
      return <UtilitiesIcon {...props} />;
    case 'INTERNET':
      return <InternetIcon {...props} />;
    case 'FURNISHINGS':
      return <FurnishingsIcon {...props} />;
    case 'CLEANING':
      return <CleaningIcon {...props} />;
    case 'LICENSING_PERMITS':
      return <LicensingIcon {...props} />;
    case 'INSURANCE':
      return <InsuranceIcon {...props} />;
    case 'STRATA':
      return <StrataIcon {...props} />;
    default:
      return <ExpensesIcon {...props} />;
  }
}
