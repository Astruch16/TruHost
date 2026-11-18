/** One icon per expense category, from the custom set (src/assets/icons/expense-categories). 40px by default. */
import type { IconProps } from './defs';
import { IconImage } from './icon-image';
import { CleaningIcon, ExpensesIcon } from './statement-icons';

/** Supplies: a taped kraft box with a label (also the general supply category). */
export function SuppliesIcon({ size = 40, className }: IconProps) {
  return <IconImage path="expense-categories/supplies" size={size} className={className} />;
}

/** Repairs and maintenance: a steel wrench with a gold grip. */
export function RepairsIcon({ size = 40, className }: IconProps) {
  return <IconImage path="expense-categories/repairs-maintenance" size={size} className={className} />;
}

/** Subscriptions: a screen on a gold stand. */
export function SubscriptionsIcon({ size = 40, className }: IconProps) {
  return <IconImage path="expense-categories/subscriptions" size={size} className={className} />;
}

/** Utilities: a lit bulb. */
export function UtilitiesIcon({ size = 40, className }: IconProps) {
  return <IconImage path="expense-categories/utilities" size={size} className={className} />;
}

/** Internet: a router under the wifi arcs. */
export function InternetIcon({ size = 40, className }: IconProps) {
  return <IconImage path="expense-categories/internet" size={size} className={className} />;
}

/** Furnishings: a tufted armchair on gold legs. */
export function FurnishingsIcon({ size = 40, className }: IconProps) {
  return <IconImage path="expense-categories/furnishings" size={size} className={className} />;
}

/** Licensing and permits: a certificate with a gold seal and ribbon. */
export function LicensingIcon({ size = 40, className }: IconProps) {
  return <IconImage path="expense-categories/licensing-permits" size={size} className={className} />;
}

/** Insurance: a blue shield with a check. */
export function InsuranceIcon({ size = 40, className }: IconProps) {
  return <IconImage path="expense-categories/insurance" size={size} className={className} />;
}

/** Strata: an apartment building with a gold door. */
export function StrataIcon({ size = 40, className }: IconProps) {
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
