import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** Nothing needs attention: a green shield with a check mark. From the custom set (src/assets/icons/empty-states); 96px by default. */
export function AllClearIllustration({ size = 96, className }: IllustrationProps) {
  return (
    <IconImage
      path="empty-states/all-clear"
      size={size}
      className={className}
      label="A green shield with a check mark"
    />
  );
}
