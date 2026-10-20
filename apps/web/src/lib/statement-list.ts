/**
 * Organising the owner's statements list: sort by month or by net to you, and narrow to a year or a month of the
 * year. Display only: the figures are the API's, never recomputed.
 */
export type StatementSort = 'newest' | 'oldest' | 'highest' | 'lowest';

export const STATEMENT_SORTS: { key: StatementSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
];

interface Listed {
  month: string; // YYYY-MM
  netCents: number;
  property: { name: string };
}

/** Narrows to a year ("2026") and a month of the year ("09"); empty strings mean all. */
export function filterStatements<T extends Listed>(items: readonly T[], year: string, month: string): T[] {
  return items.filter((s) => (!year || s.month.startsWith(`${year}-`)) && (!month || s.month.endsWith(`-${month}`)));
}

/** Sorts a copy. Ties (same month, or same amount) fall back to the newer month, then the property's name. */
export function sortStatements<T extends Listed>(items: readonly T[], sort: StatementSort): T[] {
  const byMonth = (a: T, b: T) => b.month.localeCompare(a.month) || a.property.name.localeCompare(b.property.name);
  return [...items].sort((a, b) => {
    switch (sort) {
      case 'newest':
        return byMonth(a, b);
      case 'oldest':
        return a.month.localeCompare(b.month) || a.property.name.localeCompare(b.property.name);
      case 'highest':
        return b.netCents - a.netCents || byMonth(a, b);
      case 'lowest':
        return a.netCents - b.netCents || byMonth(a, b);
    }
  });
}

/** The years with a statement, newest first, and the months of the year that have one, January first. */
export function statementPeriods(items: readonly Listed[]): { years: string[]; months: string[] } {
  const years = [...new Set(items.map((s) => s.month.slice(0, 4)))].sort().reverse();
  const months = [...new Set(items.map((s) => s.month.slice(5, 7)))].sort();
  return { years, months };
}

/** By year, newest year first when sorting newest, oldest first when sorting oldest, keeping each year's order. */
export function groupByYear<T extends Listed>(items: readonly T[]): { year: string; items: T[] }[] {
  const groups: { year: string; items: T[] }[] = [];
  for (const s of items) {
    const year = s.month.slice(0, 4);
    const last = groups.at(-1);
    if (last?.year === year) last.items.push(s);
    else groups.push({ year, items: [s] });
  }
  return groups;
}
