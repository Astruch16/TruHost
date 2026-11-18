import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** Supplies, nothing tracked yet: a roll of toilet paper beside a pump bottle. From the custom set; 96px by default. */
export function SuppliesIllustration({ size = 96, className }: IllustrationProps) {
  return (
    <IconImage
      path="empty-states/no-supplies"
      size={size}
      className={className}
      label="A roll of toilet paper and a pump bottle"
    />
  );
}

/**
 * A supply alert in the bell: a roll of toilet paper with a gauge, a third full on amber (running low) or empty on
 * rose (run out). Decorative: the alert's title says which.
 */
export function SupplyAlertIcon({ out, size = 40, className }: { out: boolean; size?: number; className?: string }) {
  return (
    <IconImage
      path={out ? 'checklist/supply-alert-out' : 'checklist/supply-alert-low'}
      size={size}
      className={className}
    />
  );
}
