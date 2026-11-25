import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** No stays: an empty calendar. From the custom set (src/assets/icons/empty-states); 96px by default. */
export function BookingsIllustration({ size = 96, className }: IllustrationProps) {
  return <IconImage path="empty-states/no-bookings" size={size} className={className} label="An empty calendar" />;
}
