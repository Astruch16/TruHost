import { describe, expect, it } from 'vitest';
import { filterStatements, groupByYear, sortStatements, statementPeriods } from './statement-list';

const s = (month: string, netCents: number, name = 'Cedar Cabin') => ({ month, netCents, property: { name } });
const ITEMS = [
  s('2026-09', 213_786, 'Seaside Loft'),
  s('2025-12', 90_000),
  s('2026-09', 280_545),
  s('2026-08', 150_000),
];
const order = (items: ReturnType<typeof s>[]) => items.map((x) => `${x.month} ${x.property.name} ${x.netCents}`);

describe('statement list', () => {
  it('sorts newest and oldest by month, then by property name', () => {
    expect(order(sortStatements(ITEMS, 'newest'))).toEqual([
      '2026-09 Cedar Cabin 280545',
      '2026-09 Seaside Loft 213786',
      '2026-08 Cedar Cabin 150000',
      '2025-12 Cedar Cabin 90000',
    ]);
    expect(order(sortStatements(ITEMS, 'oldest'))[0]).toBe('2025-12 Cedar Cabin 90000');
  });

  it('sorts highest and lowest by net to you, without changing the list it was given', () => {
    expect(sortStatements(ITEMS, 'highest').map((x) => x.netCents)).toEqual([280_545, 213_786, 150_000, 90_000]);
    expect(sortStatements(ITEMS, 'lowest').map((x) => x.netCents)).toEqual([90_000, 150_000, 213_786, 280_545]);
    expect(ITEMS[0]!.netCents).toBe(213_786);
  });

  it('narrows to a year, a month of the year, or both', () => {
    expect(filterStatements(ITEMS, '2026', '')).toHaveLength(3);
    expect(filterStatements(ITEMS, '', '09')).toHaveLength(2);
    expect(filterStatements(ITEMS, '2025', '09')).toEqual([]);
    expect(filterStatements(ITEMS, '', '')).toHaveLength(4);
  });

  it('lists the years and months that have a statement', () => {
    expect(statementPeriods(ITEMS)).toEqual({ years: ['2026', '2025'], months: ['08', '09', '12'] });
  });

  it('groups a month-sorted list by year, in its order', () => {
    expect(groupByYear(sortStatements(ITEMS, 'newest')).map((g) => [g.year, g.items.length])).toEqual([
      ['2026', 3],
      ['2025', 1],
    ]);
  });
});
