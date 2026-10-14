import {
  COMMON_SUPPLIES,
  SUPPLY_CATEGORY_LABELS,
  SUPPLY_LEVELS,
  type SupplyCategory,
  type SupplyItem,
  type SupplyState,
} from '@truhost/shared';

/** The one-tap levels a person can report, fullest first. */
export const LEVEL_OPTIONS: readonly { pct: (typeof SUPPLY_LEVELS)[number]; label: string; name: string }[] = [
  { pct: 100, label: 'Full', name: 'Full' },
  { pct: 75, label: '¾', name: 'Three quarters' },
  { pct: 50, label: '½', name: 'Half' },
  { pct: 25, label: '¼', name: 'A quarter' },
  { pct: 0, label: 'Empty', name: 'Empty' },
];

/** The order categories are shown in (bathroom first: it's where most of a walkthrough's supplies are). */
export const CATEGORY_ORDER: readonly SupplyCategory[] = ['BATHROOM', 'KITCHEN', 'LAUNDRY', 'CLEANING', 'OTHER'];

/** "Full", "¾ left", "Empty", "60% left", or "Not checked yet". */
export function levelText(levelPct: number | null): string {
  if (levelPct === null) return 'Not checked yet';
  if (levelPct === 0) return 'Empty';
  if (levelPct === 100) return 'Full';
  const option = LEVEL_OPTIONS.find((o) => o.pct === levelPct);
  return `${option ? option.label : `${levelPct}%`} left`;
}

export const STATE_LABELS: Record<SupplyState, string> = {
  UNKNOWN: 'Not checked',
  OK: 'Stocked',
  LOW: 'Running low',
  OUT: 'Out',
};

/** Items grouped by category, in CATEGORY_ORDER, each group in the property's order. Empty groups are left out. */
export function groupByCategory<T extends Pick<SupplyItem, 'category' | 'position'>>(items: readonly T[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: SUPPLY_CATEGORY_LABELS[category],
    items: items.filter((i) => i.category === category).sort((a, b) => a.position - b.position),
  })).filter((g) => g.items.length > 0);
}

/** How many items need restocking (low or out). */
export const restockCount = (items: readonly Pick<SupplyItem, 'state'>[]) =>
  items.filter((i) => i.state === 'LOW' || i.state === 'OUT').length;

/** One line for a card's header: "2 to restock", "All stocked", "Not checked yet". */
export function suppliesSummary(items: readonly Pick<SupplyItem, 'state'>[]): string {
  const due = restockCount(items);
  if (due > 0) return `${due} to restock`;
  if (items.length > 0 && items.every((i) => i.state === 'UNKNOWN')) return 'Not checked yet';
  return 'All stocked';
}

/** The common list, less what the property already tracks (by name, ignoring case). */
export function suggestedSupplies(existing: readonly { name: string }[]) {
  const taken = new Set(existing.map((i) => i.name.toLowerCase()));
  return COMMON_SUPPLIES.filter((s) => !taken.has(s.name.toLowerCase()));
}

/** "Restock at 25%": the threshold choices an admin can pick from. */
export const THRESHOLD_OPTIONS = [10, 20, 25, 30, 40, 50] as const;

/** "just now", "5 min ago", "3 hours ago", "4 days ago", or "Oct 2" (two weeks on). */
export function since(when: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - when.getTime()) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return when.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/** "Checked just now", "Checked 4 days ago", "Checked Oct 2". */
export const checkedAgo = (when: Date, now: Date = new Date()) => `Checked ${since(when, now)}`;
