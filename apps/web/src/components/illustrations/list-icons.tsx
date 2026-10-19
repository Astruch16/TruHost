import { useIllustrationIds } from '../../lib/illustration-ids';
import { IconFrame, IllustrationDefs, type IconProps } from './defs';

/** Small icons for list rows and notices, in the same style as the statement and category icons. 40×40 grid. */

/** A monthly statement: a page with a green header and a small bar chart, on sage. */
export function StatementDocIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="20" cy="33" rx="10.5" ry="2.1" fill={url.shadow} />
      <rect x="11" y="8.5" width="18" height="23" rx="2" transform="translate(1 1.2)" fill="#C9CEC6" />
      <rect x="11" y="8.5" width="18" height="23" rx="2" fill={url.paper} />
      <rect x="11" y="8.5" width="18" height="23" rx="2" fill="none" stroke="#DADDD7" strokeWidth="0.7" />
      <path d="M11 13.5 V10.5 Q11 8.5 13 8.5 H27 Q29 8.5 29 10.5 V13.5 Z" fill="#4F7A63" />
      <path d="M14 16.6 H26 M14 19.4 H22" stroke="#C9CEC6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M13.8 28.4 H26.2" stroke="#DADDD7" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="14.6" y="24.6" width="2.6" height="3.4" rx="0.5" fill="#93BFA0" />
      <rect x="18.7" y="22.8" width="2.6" height="5.2" rx="0.5" fill="#4F7A63" />
      <rect x="22.8" y="21.2" width="2.6" height="6.8" rx="0.5" fill={url.gold} />
    </IconFrame>
  );
}

/** An invitation: an envelope with a lavender flap and a gold seal, on lavender. */
export function InviteIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#E6E0F5" />
      <ellipse cx="20" cy="32.6" rx="12" ry="2.1" fill={url.shadow} />
      <rect x="8.5" y="12.5" width="23" height="16" rx="2" transform="translate(0 1.2)" fill="#CFC8E0" />
      <rect x="8.5" y="12.5" width="23" height="16" rx="2" fill={url.paper} />
      <path d="M9.2 27.8 L16.6 21 M30.8 27.8 L23.4 21" stroke="#DDD6EC" strokeWidth="1" strokeLinecap="round" />
      <path
        d="M8.5 14.5 Q8.5 12.5 10.5 12.5 H29.5 Q31.5 12.5 31.5 14.5 L20 22.6 Z"
        fill="#56478A"
        transform="translate(0 0.8)"
      />
      <path d="M8.5 14.5 Q8.5 12.5 10.5 12.5 H29.5 Q31.5 12.5 31.5 14.5 L20 22.6 Z" fill="#A99BD6" />
      <circle cx="20.4" cy="22.2" r="2.9" fill="#C99A2E" />
      <circle cx="20" cy="21.6" r="2.9" fill={url.gold} />
      <circle cx="20" cy="21.6" r="1.6" fill="none" stroke="#C99A2E" strokeWidth="0.7" />
    </IconFrame>
  );
}

/** Somewhere that isn't here: a gold compass, on sage. */
export function CompassIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="20" cy="33.4" rx="9.5" ry="1.9" fill={url.shadow} />
      <circle cx="20.5" cy="21.1" r="11" fill="#8A6A1C" />
      <circle cx="20" cy="20" r="11" fill={url.gold} />
      <circle cx="20" cy="20" r="8.6" fill={url.paper} />
      <path
        d="M20 12.4 V13.8 M20 26.2 V27.6 M12.4 20 H13.8 M26.2 20 H27.6"
        stroke="#C9CEC6"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path d="M25 15 L21.6 21.6 L18.4 18.4 Z" fill="#B33D5E" />
      <path d="M15 25 L18.4 18.4 L21.6 21.6 Z" fill="#3D5F86" />
      <circle cx="20" cy="20" r="1.1" fill={url.gold} />
      <circle cx="20" cy="20" r="11" fill={url.sheen} />
    </IconFrame>
  );
}
