import type { RoomType } from '@truhost/shared';
import { useIllustrationIds } from '../../lib/illustration-ids';
import { IconFrame, IllustrationDefs, type IconProps } from './defs';

/** An icon for each type of room, in the style of the list and step icons. 40×40 grid. */

/** Bedroom: a made bed, a lavender blanket and a gold pillow, on lavender. */
function BedroomIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#E6E0F5" />
      <ellipse cx="20" cy="31.6" rx="12" ry="2" fill={url.shadow} />
      <rect x="9" y="11" width="3.6" height="18.5" rx="1.6" fill="#3F3470" />
      <rect x="10.2" y="27" width="1.8" height="3.4" rx="0.8" fill="#3F3470" />
      <rect x="28.6" y="27" width="1.8" height="3.4" rx="0.8" fill="#3F3470" />
      <rect x="11" y="22" width="20.5" height="6" rx="1.8" fill="#56478A" />
      <rect x="12" y="18.4" width="19.5" height="5.6" rx="2" fill={url.paper} />
      <rect x="17.6" y="18.4" width="13.9" height="9.4" rx="2" fill="#6E5DB0" />
      <path d="M17.6 21.2 H31.5" stroke="#A99BD6" strokeWidth="1" />
      <rect x="12.8" y="14.8" width="5.6" height="4" rx="1.8" transform="translate(0.4 0.6)" fill="#C99A2E" />
      <rect x="12.8" y="14.8" width="5.6" height="4" rx="1.8" fill={url.gold} />
      <rect x="17.6" y="18.4" width="13.9" height="9.4" rx="2" fill={url.sheen} />
    </IconFrame>
  );
}

/** Bathroom: a white tub with gold feet and tap, and bubbles, on blue. */
function BathroomIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#DCE9F6" />
      <ellipse cx="20" cy="32" rx="12" ry="2" fill={url.shadow} />
      <path d="M11.5 19 V12.6 Q11.5 10.2 13.9 10.2 H16" fill="none" stroke="#C99A2E" strokeWidth="2" />
      <path d="M11.2 18.6 V12.4 Q11.2 10 13.6 10 H15.8" fill="none" stroke={url.gold} strokeWidth="2" />
      <circle cx="13" cy="29.2" r="1.5" fill={url.gold} />
      <circle cx="27" cy="29.2" r="1.5" fill={url.gold} />
      <path d="M8.5 20 H31.5 V22.5 Q31.5 29 25 29 H15 Q8.5 29 8.5 22.5 Z" transform="translate(0 1)" fill="#9DB7D3" />
      <path d="M8.5 20 H31.5 V22.5 Q31.5 29 25 29 H15 Q8.5 29 8.5 22.5 Z" fill={url.paper} />
      <rect x="7" y="18.4" width="26" height="2.8" rx="1.4" fill="#3D5F86" />
      <g fill="#FFFFFF" stroke="#9DB7D3" strokeWidth="0.8">
        <circle cx="20" cy="15.6" r="2" />
        <circle cx="24.6" cy="13.4" r="1.5" />
        <circle cx="23.8" cy="16.8" r="1.1" />
      </g>
      <path d="M8.5 20 H31.5 V22.5 Q31.5 29 25 29 H15 Q8.5 29 8.5 22.5 Z" fill={url.sheen} />
    </IconFrame>
  );
}

/** Half bath: a basin under a gold-framed mirror, on sage. */
function HalfBathIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="20" cy="32.4" rx="10" ry="1.9" fill={url.shadow} />
      <ellipse cx="20" cy="12.6" rx="5.4" ry="5.6" fill={url.gold} />
      <ellipse cx="20" cy="12.6" rx="4" ry="4.2" fill="#DCE9F6" />
      <path d="M17.6 11.2 L19.8 9.4" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
      <rect x="19.1" y="18.6" width="1.8" height="3.4" rx="0.6" fill="#C99A2E" />
      <path d="M11.5 23 H28.5 Q28 30.5 20 30.5 Q12 30.5 11.5 23 Z" transform="translate(0 0.9)" fill="#9CB3A3" />
      <path d="M11.5 23 H28.5 Q28 30.5 20 30.5 Q12 30.5 11.5 23 Z" fill={url.paper} />
      <rect x="10" y="21.4" width="20" height="2.6" rx="1.3" fill="#4F7A63" />
      <path d="M11.5 23 H28.5 Q28 30.5 20 30.5 Q12 30.5 11.5 23 Z" fill={url.sheen} />
    </IconFrame>
  );
}

/** Kitchen: a green pot with a gold knob, steaming, on amber. */
function KitchenIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#FBEECB" />
      <ellipse cx="20" cy="31.8" rx="11" ry="2" fill={url.shadow} />
      <path
        d="M16 11.4 Q14.6 9.6 16 7.8 M20 10.6 Q18.6 8.8 20 7 M24 11.4 Q22.6 9.6 24 7.8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect x="7" y="19.4" width="4.4" height="2.4" rx="1.2" fill="#2F5548" />
      <rect x="28.6" y="19.4" width="4.4" height="2.4" rx="1.2" fill="#2F5548" />
      <rect x="10.5" y="16.8" width="19" height="13" rx="3" transform="translate(0.6 1)" fill="#2F5548" />
      <rect x="10.5" y="16.8" width="19" height="13" rx="3" fill="#4F7A63" />
      <path d="M9.6 17.4 Q9.6 14.2 20 14.2 Q30.4 14.2 30.4 17.4 Z" fill="#93BFA0" />
      <circle cx="20" cy="13.4" r="1.8" fill={url.gold} />
      <rect x="10.5" y="16.8" width="19" height="13" rx="3" fill={url.sheen} />
    </IconFrame>
  );
}

/** Living room: a rose sofa with a gold cushion, on rose. */
function LivingIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#FBE2EA" />
      <ellipse cx="20" cy="31.4" rx="12.5" ry="2" fill={url.shadow} />
      <rect x="9.5" y="27.4" width="1.8" height="2.8" rx="0.8" fill="#8B2350" />
      <rect x="28.7" y="27.4" width="1.8" height="2.8" rx="0.8" fill="#8B2350" />
      <rect x="10" y="12.4" width="20" height="10" rx="3" fill="#8B2350" />
      <rect x="10" y="12" width="20" height="10" rx="3" fill="#C2477A" />
      <rect x="9" y="20.4" width="22" height="7.4" rx="2.2" fill="#B33D5E" />
      <path d="M20 21 V27" stroke="#8B2350" strokeWidth="0.9" strokeOpacity="0.5" />
      <rect x="6.6" y="17" width="4.8" height="11" rx="2.4" fill="#8B2350" />
      <rect x="28.6" y="17" width="4.8" height="11" rx="2.4" fill="#8B2350" />
      <rect x="13" y="15.2" width="5.4" height="5.4" rx="1.4" transform="rotate(-8 15.7 17.9)" fill={url.gold} />
      <rect x="10" y="12" width="20" height="10" rx="3" fill={url.sheen} />
    </IconFrame>
  );
}

/** Dining room: a plate seen from above, a gold fork and a knife, on amber. */
function DiningIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#FBEECB" />
      <ellipse cx="20" cy="31.4" rx="9" ry="1.7" fill={url.shadow} />
      <circle cx="20.4" cy="20.8" r="9" fill="#D9BE7E" />
      <circle cx="20" cy="20" r="9" fill={url.paper} />
      <circle cx="20" cy="20" r="6" fill="none" stroke="#E3E4E1" strokeWidth="1" />
      <circle cx="20" cy="20" r="3.4" fill="#93BFA0" />
      <path
        d="M7.4 10 V15 Q7.4 16.6 8.6 16.6 Q9.8 16.6 9.8 15 V10 M8.6 10 V30"
        fill="none"
        stroke={url.gold}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M31.6 30 V10 Q33.4 12.6 33.4 17 Q33.4 19 31.6 19"
        fill="#9DB7D3"
        stroke="#9DB7D3"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="9" fill={url.sheen} />
    </IconFrame>
  );
}

/** Laundry: a washing machine with a blue door and a gold dial, on blue. */
function LaundryIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#DCE9F6" />
      <ellipse cx="20" cy="32.8" rx="10.5" ry="2" fill={url.shadow} />
      <rect x="11" y="8" width="18" height="23.5" rx="2.4" transform="translate(0.8 1.1)" fill="#9DB7D3" />
      <rect x="11" y="8" width="18" height="23.5" rx="2.4" fill={url.paper} />
      <rect x="11" y="8" width="18" height="23.5" rx="2.4" fill="none" stroke="#C9D6E4" strokeWidth="0.8" />
      <path d="M11 13.6 H29" stroke="#C9D6E4" strokeWidth="0.8" />
      <circle cx="25.4" cy="10.8" r="1.4" fill={url.gold} />
      <rect x="13.4" y="10.1" width="5" height="1.4" rx="0.7" fill="#C9D6E4" />
      <circle cx="20" cy="22.4" r="6.4" fill="#3D5F86" />
      <circle cx="20" cy="22.4" r="4.8" fill="#9DB7D3" />
      <path
        d="M15.4 23.4 Q17.7 21.6 20 23.4 Q22.3 25.2 24.6 23.4 V24 Q24 27.2 20 27.2 Q16 27.2 15.4 24 Z"
        fill="#5B87B8"
      />
      <circle cx="20" cy="22.4" r="6.4" fill={url.sheen} />
    </IconFrame>
  );
}

/** Entry: a gold house key, on sage. */
function EntryIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  const key = 'M14.6 14 A6 6 0 1 0 19.9 22.4 H24.4 V25.4 H27.4 V22.4 H29.6 V18.4 H19.9 A6 6 0 0 0 14.6 14 Z';
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="20" cy="30.4" rx="10.5" ry="1.9" fill={url.shadow} />
      <path d={key} transform="translate(0.6 1)" fill="#8A6A1C" />
      <path d={key} fill={url.gold} />
      <circle cx="14.4" cy="20" r="2.3" fill="#DDEBDF" />
      <path d="M22 20.4 H28" stroke="#C99A2E" strokeWidth="0.8" strokeLinecap="round" />
      <path d={key} fill={url.sheen} />
    </IconFrame>
  );
}

/** Office: a laptop with a little gold chart on its screen, on lavender. */
function OfficeIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#E6E0F5" />
      <ellipse cx="20" cy="30.6" rx="12.5" ry="2" fill={url.shadow} />
      <rect x="10.5" y="10" width="19" height="14" rx="1.8" fill="#3F3470" />
      <rect x="12" y="11.5" width="16" height="11" rx="0.8" fill={url.paper} />
      <rect x="14.4" y="18.2" width="2.4" height="2.6" rx="0.4" fill="#A99BD6" />
      <rect x="18.4" y="16.2" width="2.4" height="4.6" rx="0.4" fill="#6E5DB0" />
      <rect x="22.4" y="14" width="2.4" height="6.8" rx="0.4" fill={url.gold} />
      <path d="M7.5 24.6 H32.5 L31 28 Q30.6 28.8 29.6 28.8 H10.4 Q9.4 28.8 9 28 Z" fill="#56478A" />
      <path d="M7.5 24.6 H32.5 L32.1 25.6 H7.9 Z" fill="#A99BD6" />
      <rect x="17.6" y="25.6" width="4.8" height="1.2" rx="0.6" fill="#3F3470" />
      <rect x="10.5" y="10" width="19" height="14" rx="1.8" fill={url.sheen} />
    </IconFrame>
  );
}

/** Patio or deck: a striped green parasol over wooden boards, on sage. */
function PatioIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="20" cy="31.6" rx="12" ry="1.9" fill={url.shadow} />
      <rect x="8" y="26.4" width="24" height="2" rx="1" fill="#B8975A" />
      <rect x="8" y="28.6" width="24" height="2" rx="1" fill="#D9BE7E" />
      <rect x="19.3" y="14" width="1.4" height="12.6" rx="0.7" fill="#8A6A1C" />
      <path d="M8 17.4 Q20 4.6 32 17.4 Z" fill="#4F7A63" />
      <path d="M15.6 17.4 Q17.2 9.4 20 8.2 Q22.8 9.4 24.4 17.4 Z" fill="#93BFA0" />
      <circle cx="20" cy="7.8" r="1.3" fill={url.gold} />
      <path d="M8 17.4 Q20 4.6 32 17.4 Z" fill={url.sheen} />
    </IconFrame>
  );
}

/** Hot tub: a cedar tub of blue water, bubbling and steaming, on blue. */
function HotTubIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#DCE9F6" />
      <ellipse cx="20" cy="31.8" rx="12.5" ry="2" fill={url.shadow} />
      <path
        d="M15 13 Q13.6 11.2 15 9.4 M20 12.2 Q18.6 10.4 20 8.6 M25 13 Q23.6 11.2 25 9.4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect x="7.5" y="16" width="25" height="13.5" rx="4" transform="translate(0.6 1)" fill="#8A6A1C" />
      <rect x="7.5" y="16" width="25" height="13.5" rx="4" fill="#C99A5B" />
      <path d="M13.5 17 V29 M20 17 V29 M26.5 17 V29" stroke="#B07F45" strokeWidth="0.8" />
      <rect x="9.6" y="17.8" width="20.8" height="5.8" rx="2.9" fill="#3D5F86" />
      <rect x="10.4" y="18.5" width="19.2" height="4.4" rx="2.2" fill="#5B87B8" />
      <g fill="#FFFFFF" fillOpacity="0.85">
        <circle cx="14.6" cy="20.6" r="0.9" />
        <circle cx="19" cy="19.8" r="0.7" />
        <circle cx="23.8" cy="20.8" r="1" />
      </g>
      <rect x="7.5" y="16" width="25" height="13.5" rx="4" fill={url.sheen} />
      <rect x="18" y="26.4" width="4" height="1.4" rx="0.7" fill={url.gold} />
    </IconFrame>
  );
}

/** Garage: a green garage with a white roll-up door and a gold lamp, on rose. */
function GarageIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#FBE2EA" />
      <ellipse cx="20" cy="32" rx="12" ry="2" fill={url.shadow} />
      <path d="M8 16.6 L20 8.6 L32 16.6 V30.4 H8 Z" transform="translate(0.7 1)" fill="#2F5548" />
      <path d="M8 16.6 L20 8.6 L32 16.6 V30.4 H8 Z" fill="#4F7A63" />
      <path
        d="M6.6 17.2 L20 8.2 L33.4 17.2"
        fill="none"
        stroke="#2F5548"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="12" y="19.4" width="16" height="11" rx="0.8" fill={url.paper} />
      <path d="M12 22.2 H28 M12 25 H28 M12 27.8 H28" stroke="#C9CEC6" strokeWidth="0.8" />
      <circle cx="20" cy="15.4" r="1.8" fill={url.gold} />
      <path d="M8 16.6 L20 8.6 L32 16.6 V30.4 H8 Z" fill={url.sheen} />
    </IconFrame>
  );
}

/** Any other room: gold sparkles, on amber. */
function OtherRoomIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  const star = (cx: number, cy: number, r: number) =>
    `M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold']} />
      <circle cx="20" cy="20" r="19" fill="#FBEECB" />
      <ellipse cx="18" cy="31" rx="8" ry="1.6" fill={url.shadow} />
      <path d={star(18, 19, 9)} transform="translate(0.6 1)" fill="#C99A2E" />
      <path d={star(18, 19, 9)} fill={url.gold} />
      <path d={star(18, 19, 9)} fill={url.sheen} />
      <path d={star(28.4, 11.4, 3.6)} fill="#4F7A63" />
      <path d={star(29, 26, 2.6)} fill="#93BFA0" />
    </IconFrame>
  );
}

/** Each room type's icon: a bed, a tub, a basin, a pot, a sofa, a plate, a washer, a key, a laptop, a parasol, a hot
 * tub, a garage, or sparkles for any other room. */
export function RoomIcon({ type, ...props }: IconProps & { type: RoomType }) {
  switch (type) {
    case 'BEDROOM':
      return <BedroomIcon {...props} />;
    case 'BATHROOM':
      return <BathroomIcon {...props} />;
    case 'HALF_BATH':
      return <HalfBathIcon {...props} />;
    case 'KITCHEN':
      return <KitchenIcon {...props} />;
    case 'LIVING':
      return <LivingIcon {...props} />;
    case 'DINING':
      return <DiningIcon {...props} />;
    case 'LAUNDRY':
      return <LaundryIcon {...props} />;
    case 'ENTRY':
      return <EntryIcon {...props} />;
    case 'OFFICE':
      return <OfficeIcon {...props} />;
    case 'PATIO_DECK':
      return <PatioIcon {...props} />;
    case 'HOT_TUB':
      return <HotTubIcon {...props} />;
    case 'GARAGE':
      return <GarageIcon {...props} />;
    case 'OTHER':
      return <OtherRoomIcon {...props} />;
  }
}
