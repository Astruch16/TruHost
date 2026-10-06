import type { PageQuery } from '@truhost/shared';

/**
 * Cursor pagination over UUIDv7 ids (time-ordered). Pass the result's `args` to `findMany`, then
 * `page(rows)` to trim the look-ahead row and compute `nextCursor`.
 */
export function cursorPage(query: PageQuery, direction: 'asc' | 'desc' = 'desc') {
  return {
    args: {
      take: query.limit + 1,
      orderBy: { id: direction },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    },
    page<T extends { id: string }>(rows: T[]): { items: T[]; nextCursor: string | null } {
      const hasMore = rows.length > query.limit;
      const items = hasMore ? rows.slice(0, query.limit) : rows;
      return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
    },
  };
}
