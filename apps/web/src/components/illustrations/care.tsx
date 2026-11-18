import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** No clean photos yet: two instant photos of a tidy room. From the custom set (src/assets/icons/empty-states); 96px by default. */
export function CareIllustration({ size = 96, className }: IllustrationProps) {
  return (
    <IconImage
      path="empty-states/no-clean-photos"
      size={size}
      className={className}
      label="Two instant photos of a tidy room"
    />
  );
}
