import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** Nothing coming up: a cabin waiting for its next guests. From the custom set (src/assets/icons/empty-states); 96px by default. */
export function ComingUpIllustration({ size = 96, className }: IllustrationProps) {
  return (
    <IconImage
      path="empty-states/nothing-coming-up"
      size={size}
      className={className}
      label="A cabin waiting for its next guests"
    />
  );
}
