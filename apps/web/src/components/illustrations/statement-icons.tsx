/**
 * Small icons for the owner's month statement and the money rows elsewhere (Needs attention), from the custom set
 * (src/assets/icons/money). 40px by default. Decorative: the line's label says what it is.
 */
import type { IconProps } from './defs';
import { IconImage } from './icon-image';

/** Gross revenue: a banknote with a gold coin. */
export function GrossIcon({ size = 40, className }: IconProps) {
  return <IconImage path="money/gross-revenue" size={size} className={className} />;
}

/** Management fee: a price tag with a percent sign. */
export function FeeIcon({ size = 40, className }: IconProps) {
  return <IconImage path="money/management-fee" size={size} className={className} />;
}

/** No fee on an own property: a little house with a gold door. */
export function OwnPropertyIcon({ size = 40, className }: IconProps) {
  return <IconImage path="money/own-property" size={size} className={className} />;
}

/** Expenses: a receipt with a gold coin (also any expense category without its own icon). */
export function ExpensesIcon({ size = 40, className }: IconProps) {
  return <IconImage path="money/expenses" size={size} className={className} />;
}

/** Owner-stay cleaning: a spray bottle with gold sparkles (also the Cleaning supply category). */
export function CleaningIcon({ size = 40, className }: IconProps) {
  return <IconImage path="money/owner-stay-cleaning" size={size} className={className} />;
}

/** Adjustments: a note being corrected with a gold pencil. */
export function AdjustmentIcon({ size = 40, className }: IconProps) {
  return <IconImage path="money/adjustments" size={size} className={className} />;
}
