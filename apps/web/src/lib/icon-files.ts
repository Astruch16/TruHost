/**
 * TruHost's custom icons (src/assets/icons, see its README for the style): 41 UI icons on a 40×40 grid and 9
 * empty-state illustrations on 96×96. Each is a static SVG file bundled by Vite; `iconUrl` gives its URL from its
 * path in that folder, without the extension ("money/gross-revenue").
 */
export type IconPath =
  | 'checklist/after-photos'
  | 'checklist/before-photos'
  | 'checklist/damage-alert'
  | 'checklist/supply-alert-low'
  | 'checklist/supply-alert-out'
  | 'empty-states/all-clear'
  | 'empty-states/damage'
  | 'empty-states/no-bookings'
  | 'empty-states/no-clean-photos'
  | 'empty-states/no-expenses'
  | 'empty-states/no-receipts'
  | 'empty-states/no-supplies'
  | 'empty-states/nothing-coming-up'
  | 'empty-states/revenue'
  | 'expense-categories/furnishings'
  | 'expense-categories/insurance'
  | 'expense-categories/internet'
  | 'expense-categories/licensing-permits'
  | 'expense-categories/repairs-maintenance'
  | 'expense-categories/strata'
  | 'expense-categories/subscriptions'
  | 'expense-categories/supplies'
  | 'expense-categories/utilities'
  | 'money/adjustments'
  | 'money/expenses'
  | 'money/gross-revenue'
  | 'money/management-fee'
  | 'money/own-property'
  | 'money/owner-stay-cleaning'
  | 'notices/cleans-done'
  | 'notices/compass'
  | 'notices/free-from'
  | 'notices/invitation'
  | 'notices/monthly-statement'
  | 'notices/ready-by'
  | 'notices/this-week'
  | 'notices/time-off'
  | 'rooms/bathroom'
  | 'rooms/bedroom'
  | 'rooms/dining-room'
  | 'rooms/entry'
  | 'rooms/garage'
  | 'rooms/half-bath'
  | 'rooms/hot-tub'
  | 'rooms/kitchen'
  | 'rooms/laundry'
  | 'rooms/living-room'
  | 'rooms/office'
  | 'rooms/other-room'
  | 'rooms/patio-deck';

const FILES = import.meta.glob<string>('../assets/icons/**/*.svg', { eager: true, query: '?url', import: 'default' });

export function iconUrl(path: IconPath): string {
  const url = FILES[`../assets/icons/${path}.svg`];
  if (!url) throw new Error(`No icon file for ${path}`);
  return url;
}
