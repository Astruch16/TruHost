/** One icon per expense category, from the custom set (src/assets/icons/expense-categories). 24px by default. */
import type { IconProps } from './defs';
import { IconImage } from './icon-image';
import { CleaningIcon, ExpensesIcon } from './statement-icons';

/** Supplies: a box (also the general supply category). */
export function SuppliesIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/supplies" size={size} className={className} />;
}

/** Repairs and maintenance: a wrench. */
export function RepairsIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/repairs-maintenance" size={size} className={className} />;
}

/** Subscriptions: circular arrows, for something that renews. */
export function SubscriptionsIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/subscriptions" size={size} className={className} />;
}

/** Utilities: a light bulb. */
export function UtilitiesIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/utilities" size={size} className={className} />;
}

/** Internet: a wifi signal. */
export function InternetIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/internet" size={size} className={className} />;
}

/** Furnishings: an armchair. */
export function FurnishingsIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/furnishings" size={size} className={className} />;
}

/** Licensing and permits: a certificate with a seal. */
export function LicensingIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/licensing-permits" size={size} className={className} />;
}

/** Insurance: a shield with a check. */
export function InsuranceIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/insurance" size={size} className={className} />;
}

/** Strata: an apartment building. */
export function StrataIcon({ size = 24, className }: IconProps) {
  return <IconImage path="expense-categories/strata" size={size} className={className} />;
}

/** The icon for an expense category; anything unknown gets the receipt. */
export function ExpenseCategoryIcon({ category, ...props }: IconProps & { category: string | null }) {
  switch (category) {
    case 'SUPPLIES':
      return <SuppliesIcon {...props} />;
    case 'REPAIRS_MAINTENANCE':
      return <RepairsIcon {...props} />;
    case 'SUBSCRIPTIONS':
      return <SubscriptionsIcon {...props} />;
    case 'UTILITIES':
      return <UtilitiesIcon {...props} />;
    case 'INTERNET':
      return <InternetIcon {...props} />;
    case 'FURNISHINGS':
      return <FurnishingsIcon {...props} />;
    case 'CLEANING':
      return <CleaningIcon {...props} />;
    case 'LICENSING_PERMITS':
      return <LicensingIcon {...props} />;
    case 'INSURANCE':
      return <InsuranceIcon {...props} />;
    case 'STRATA':
      return <StrataIcon {...props} />;
    default:
      return <ExpensesIcon {...props} />;
  }
}
