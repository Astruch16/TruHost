/** How Coming up lists its check-ins and check-outs: by date, or grouped by property. */
export type UpcomingSort = 'date' | 'property';

const KEY = 'truhost:comingUpSort';

/** The sort this browser last chose (a convenience: anything unreadable falls back to by date). */
export function readUpcomingSort(): UpcomingSort {
  try {
    return localStorage.getItem(KEY) === 'property' ? 'property' : 'date';
  } catch {
    return 'date';
  }
}

export function saveUpcomingSort(sort: UpcomingSort): void {
  try {
    localStorage.setItem(KEY, sort);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

/**
 * The events grouped by property, properties in name order, each property's events in the order given (by date, as
 * the API sends them).
 */
export function byProperty<T extends { propertyName: string }>(
  items: readonly T[],
): { property: string; items: T[] }[] {
  const names = [...new Set(items.map((i) => i.propertyName))].sort((a, b) => a.localeCompare(b));
  return names.map((property) => ({ property, items: items.filter((i) => i.propertyName === property) }));
}
