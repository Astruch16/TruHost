import type { CleanStep } from '@truhost/shared';
import { SuppliesIcon } from './category-icons';
import { DamageAlertIcon } from './damage';
import type { IconProps } from './defs';
import { IconImage } from './icon-image';
import { CleanDoneIcon } from './list-icons';

/** The icons of a clean's checklist steps, from the custom set (src/assets/icons/checklist). 24px by default. */

/** Before photos: a camera. */
export function BeforePhotosIcon({ size = 24, className }: IconProps) {
  return <IconImage path="checklist/before-photos" size={size} className={className} />;
}

/** After photos: a photo with a sparkle. */
export function AfterPhotosIcon({ size = 24, className }: IconProps) {
  return <IconImage path="checklist/after-photos" size={size} className={className} />;
}

/** Each checklist step's icon: a camera, the cracked frame, the supplies box, the photo, the ticked clipboard. */
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
