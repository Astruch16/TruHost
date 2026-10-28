import type { CleanStep } from '@truhost/shared';
import { useIllustrationIds } from '../../lib/illustration-ids';
import { SuppliesIcon } from './category-icons';
import { DamageAlertIcon } from './damage';
import { IconFrame, IllustrationDefs, type IconProps } from './defs';
import { CleanDoneIcon } from './list-icons';

/** The icons of a clean's checklist steps, in the style of the list and category icons. 40×40 grid. */

/** Before photos: a lavender camera with a gold lens ring, on lavender. */
export function BeforePhotosIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#E6E0F5" />
      <ellipse cx="20" cy="32.6" rx="12" ry="2.1" fill={url.shadow} />
      <rect x="8" y="14" width="24" height="15.5" rx="2.6" transform="translate(0 1.3)" fill="#3F3470" />
      <path d="M15 14.4 L16.8 11 Q17.2 10.3 18 10.3 H22 Q22.8 10.3 23.2 11 L25 14.4 Z" fill="#56478A" />
      <rect x="8" y="14" width="24" height="15.5" rx="2.6" fill="#6E5DB0" />
      <rect x="10.4" y="16.2" width="3.4" height="1.8" rx="0.6" fill="#A99BD6" />
      <rect x="26.2" y="16.2" width="3.4" height="1.8" rx="0.6" fill={url.paper} />
      {/* The lens */}
      <circle cx="20.4" cy="22.6" r="6" fill="#8A6A1C" />
      <circle cx="20" cy="21.8" r="6" fill={url.gold} />
      <circle cx="20" cy="21.8" r="4.3" fill="#2B2450" />
      <circle cx="20" cy="21.8" r="2.6" fill="#5B87B8" />
      <circle cx="18.9" cy="20.7" r="0.9" fill="#FFFFFF" fillOpacity="0.85" />
      <rect x="8" y="14" width="24" height="15.5" rx="2.6" fill={url.sheen} />
    </IconFrame>
  );
}

/** After photos: a photo of a made bed, with a gold sparkle, on sage. */
export function AfterPhotosIcon(props: IconProps) {
  const { id, url } = useIllustrationIds();
  return (
    <IconFrame {...props}>
      <IllustrationDefs ids={id} use={['shadow', 'sheen', 'gold', 'paper']} />
      <circle cx="20" cy="20" r="19" fill="#DDEBDF" />
      <ellipse cx="19.5" cy="32.8" rx="11" ry="2.1" fill={url.shadow} />
      <rect x="9.5" y="8.5" width="19" height="22" rx="1.8" transform="translate(0.8 1.2)" fill="#93BFA0" />
      <rect x="9.5" y="8.5" width="19" height="22" rx="1.8" fill={url.paper} />
      <rect x="9.5" y="8.5" width="19" height="22" rx="1.8" fill="none" stroke="#D5DDD3" strokeWidth="0.7" />
      {/* The picture: a wall, a made bed and its pillows */}
      <rect x="11.8" y="10.8" width="14.4" height="13" rx="0.8" fill="#DCE9F6" />
      <path d="M11.8 21 H26.2 V23 Q26.2 23.8 25.4 23.8 H12.6 Q11.8 23.8 11.8 23 Z" fill="#C9CEC6" />
      <rect x="13.4" y="16.6" width="11.2" height="5" rx="1" fill="#4F7A63" />
      <rect x="13.4" y="16.6" width="11.2" height="1.6" rx="0.8" fill="#74BB8C" />
      <rect x="14" y="14.4" width="4.4" height="2.6" rx="1" fill="#FFFFFF" />
      <rect x="19.6" y="14.4" width="4.4" height="2.6" rx="1" fill="#FFFFFF" />
      <path d="M13 27.2 H22" stroke="#DADDD7" strokeWidth="1" strokeLinecap="round" />
      {/* The sparkle */}
      <path d="M29.6 6.8 Q30.2 10.4 33.6 11 Q30.2 11.6 29.6 15.2 Q29 11.6 25.6 11 Q29 10.4 29.6 6.8 Z" fill="#C99A2E" />
      <path
        d="M29.4 6.4 Q30 10 33.4 10.6 Q30 11.2 29.4 14.8 Q28.8 11.2 25.4 10.6 Q28.8 10 29.4 6.4 Z"
        fill={url.gold}
      />
      <path d="M31 26 Q31.3 27.7 33 28 Q31.3 28.3 31 30 Q30.7 28.3 29 28 Q30.7 27.7 31 26 Z" fill={url.gold} />
    </IconFrame>
  );
}

/** Each checklist step's icon: a camera, the cracked frame, the supplies box, the made bed, the ticked clipboard. */
export function CleanStepIcon({ step, ...props }: IconProps & { step: CleanStep }) {
  switch (step) {
    case 'BEFORE_PHOTOS':
      return <BeforePhotosIcon {...props} />;
    case 'DAMAGE':
      return <DamageAlertIcon {...props} />;
    case 'STOCK_COUNT':
      return <SuppliesIcon {...props} />;
    case 'AFTER_PHOTOS':
      return <AfterPhotosIcon {...props} />;
    case 'FINISH':
      return <CleanDoneIcon {...props} />;
  }
}
