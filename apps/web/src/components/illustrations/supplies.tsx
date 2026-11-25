import { cx } from '../../lib/cx';
import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** Supplies, nothing tracked yet: an open, empty box. From the custom set; 96px by default. */
export function SuppliesIllustration({ size = 96, className }: IllustrationProps) {
  return <IconImage path="empty-states/no-supplies" size={size} className={className} label="An open, empty box" />;
}

/**
 * A supply alert in the bell: a roll of toilet paper with a gauge, a third full on amber (running low) or empty on
 * rose (run out). Decorative: the alert's title says which.
 */
export function SupplyAlertIcon({ out, size = 24, className }: { out: boolean; size?: number; className?: string }) {
  return (
    <IconImage
      path={out ? 'checklist/supply-alert-out' : 'checklist/supply-alert-low'}
      size={size}
      className={out ? cx('text-danger-mid', className) : className}
    />
  );
}
