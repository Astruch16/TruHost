/**
 * TruHost's custom icons (src/assets/icons, see its README for the style): 41 monoline UI icons on a 24×24 grid and 9
 * empty-state illustrations on 64×64, all drawn in `currentColor`. Each file is bundled as text so it can be drawn
 * inline and take the CSS colour around it; `iconSvg` gives its viewBox, stroke width and inner markup from its path
 * in that folder, without the extension ("money/gross-revenue").
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

const FILES = import.meta.glob<string>('../assets/icons/**/*.svg', { eager: true, query: '?raw', import: 'default' });

export interface IconSvg {
  viewBox: string;
  /** Set on the root of the UI icons (2); the empty states set it inside. */
  strokeWidth: string | undefined;
  /** Everything inside the root <svg>, as written in the file. */
  body: string;
}

const parsed = new Map<IconPath, IconSvg>();

/**
 * The parts of an icon's file needed to draw it inline. The root's own attributes (the default navy `color`, the size)
 * are dropped: the icon takes its colour from CSS and its size from the component.
 */
export function iconSvg(path: IconPath): IconSvg {
  const cached = parsed.get(path);
  if (cached) return cached;
  const text = FILES[`../assets/icons/${path}.svg`];
  const match = text && /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(text);
  if (!match) throw new Error(`No icon file for ${path}`);
  const [, attrs, body] = match;
  const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];
  const svg = { viewBox: attr('viewBox') ?? '0 0 24 24', strokeWidth: attr('stroke-width'), body: body.trim() };
  parsed.set(path, svg);
  return svg;
}
