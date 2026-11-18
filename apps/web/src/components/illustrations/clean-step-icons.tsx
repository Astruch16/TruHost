import type { CleanStep } from '@truhost/shared';
import { SuppliesIcon } from './category-icons';
import { DamageAlertIcon } from './damage';
import type { IconProps } from './defs';
import { IconImage } from './icon-image';
import { CleanDoneIcon } from './list-icons';

/** The icons of a clean's checklist steps, from the custom set (src/assets/icons/checklist). 40px by default. */

/** Before photos: a camera with a gold lens ring. */
export function BeforePhotosIcon({ size = 40, className }: IconProps) {
  return <IconImage path="checklist/before-photos" size={size} className={className} />;
}

/** After photos: a photo of a made bed, with a gold sparkle. */
export function AfterPhotosIcon({ size = 40, className }: IconProps) {
  return <IconImage path="checklist/after-photos" size={size} className={className} />;
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
