import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** "Where the revenue went" is empty: a rising bar chart. From the custom set (src/assets/icons/empty-states); 96px by default. */
export function RevenueIllustration({ size = 96, className }: IllustrationProps) {
  return <IconImage path="empty-states/revenue" size={size} className={className} label="A rising bar chart" />;
}
