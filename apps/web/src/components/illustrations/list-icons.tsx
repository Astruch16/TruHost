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
      {/* Centred on the disc: the page and its depth copy (straight below it) span 7.6–30.9, the shadow sits under. */}
      <ellipse cx="20" cy="32.3" rx="10" ry="2" fill={url.shadow} />
      <rect x="11.5" y="7.6" width="17" height="22" rx="2" transform="translate(0 1.3)" fill="#C9CEC6" />
      <rect x="11.5" y="7.6" width="17" height="22" rx="2" fill={url.paper} />
      <rect x="11.5" y="7.6" width="17" height="22" rx="2" fill="none" stroke="#DADDD7" strokeWidth="0.7" />
      <path d="M11.5 12.4 V9.6 Q11.5 7.6 13.5 7.6 H26.5 Q28.5 7.6 28.5 9.6 V12.4 Z" fill="#4F7A63" />
      <path d="M14.4 15.6 H25.6 M14.4 18.4 H22" stroke="#C9CEC6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M14 26.6 H26" stroke="#DADDD7" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="14.4" y="23.4" width="2.8" height="2.8" rx="0.5" fill="#93BFA0" />
      <rect x="18.6" y="21.8" width="2.8" height="4.4" rx="0.5" fill="#4F7A63" />
      <rect x="22.8" y="20.2" width="2.8" height="6" rx="0.5" fill={url.gold} />
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

/** Cleans done: a clipboard with a gold clip and a green tick, on blue. */
export function CleanDoneIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#DCE9F6" />
      <ellipse cx="20" cy="32.8" rx="11" ry="2.1" fill={url.shadow} />
      <rect x="11" y="9.5" width="17" height="21.5" rx="2" transform="translate(0.8 1.2)" fill="#9DB7D3" />
      <rect x="11" y="9.5" width="17" height="21.5" rx="2" fill={url.paper} />
      <rect x="11" y="9.5" width="17" height="21.5" rx="2" fill="none" stroke="#C9D6E4" strokeWidth="0.8" />
      {/* The clip */}
      <rect x="16" y="7.6" width="7" height="4" rx="1.2" transform="translate(0 0.8)" fill="#8A6A1C" />
      <rect x="16" y="7.6" width="7" height="4" rx="1.2" fill={url.gold} />
      <path d="M14 16 H25 M14 19.5 H22.5 M14 23 H19.5" stroke="#B8C8DA" strokeWidth="1.3" strokeLinecap="round" />
      {/* The tick */}
      <circle cx="26.5" cy="26" r="6" fill="#2F5548" />
      <circle cx="26" cy="24.9" r="6" fill="#4F7A63" />
      <circle cx="26" cy="24.9" r="6" fill={url.sheen} />
      <path
        d="M23.3 25 L25.2 26.9 L28.8 23.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}
