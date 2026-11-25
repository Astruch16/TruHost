import { cx } from '../../lib/cx';
import type { IllustrationProps } from './defs';
import { IconImage } from './icon-image';

/** Damage: a framed picture with a crack across its glass. From the custom set; 96px by default. */
export function DamageIllustration({ size = 96, className }: IllustrationProps) {
  return (
    <IconImage
      path="empty-states/damage"
      size={size}
      className={className}
      label="A framed picture with cracked glass"
    />
  );
}

/**
 * A damage report in the bell (and the clean checklist's damage step): the cracked frame, small, in the danger colour.
 * Decorative.
 */
export function DamageAlertIcon({ size = 24, className }: { size?: number; className?: string }) {
  return <IconImage path="checklist/damage-alert" size={size} className={cx('text-danger-mid', className)} />;
}
