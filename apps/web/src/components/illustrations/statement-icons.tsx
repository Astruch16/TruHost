/**
 * Small icons for the owner's month statement and the money rows elsewhere (Needs attention), from the custom set
 * (src/assets/icons/money). 24px by default. Decorative: the line's label says what it is.
 */
import type { IconProps } from './defs';
import { IconImage } from './icon-image';

/** Gross revenue: a banknote. */
export function GrossIcon({ size = 24, className }: IconProps) {
  return <IconImage path="money/gross-revenue" size={size} className={className} />;
}

/** Management fee: a percent sign. */
export function FeeIcon({ size = 24, className }: IconProps) {
  return <IconImage path="money/management-fee" size={size} className={className} />;
}

/** No fee on an own property: a house. */
export function OwnPropertyIcon({ size = 24, className }: IconProps) {
  return <IconImage path="money/own-property" size={size} className={className} />;
}

/** Expenses: a receipt (also any expense category without its own icon). */
export function ExpensesIcon({ size = 24, className }: IconProps) {
  return <IconImage path="money/expenses" size={size} className={className} />;
}

/** Owner-stay cleaning: a spray bottle (also the Cleaning supply category). */
export function CleaningIcon({ size = 24, className }: IconProps) {
  return <IconImage path="money/owner-stay-cleaning" size={size} className={className} />;
}

/** Adjustments: a pair of sliders. */
export function AdjustmentIcon({ size = 24, className }: IconProps) {
  return <IconImage path="money/adjustments" size={size} className={className} />;
}
