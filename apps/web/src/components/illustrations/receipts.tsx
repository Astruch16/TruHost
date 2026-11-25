import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** No receipts: an empty receipt. From the custom set (src/assets/icons/empty-states); 96px by default. */
export function ReceiptsIllustration({ size = 96, className }: IllustrationProps) {
  return <IconImage path="empty-states/no-receipts" size={size} className={className} label="An empty receipt" />;
}
