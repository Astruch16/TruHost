import { shortDate } from './months';

/** One thing on the dashboard's Needs attention list, as the API returns it. */
export interface AttentionItem {
  kind: 'PAYOUT_MISSING' | 'RECEIPT_MISSING' | 'NO_PLAN' | 'INVITE_PENDING';
  id: string;
  propertyId: string | null;
  propertyName: string | null;
  title: string;
  detail: string;
  date: string | null;
}

/** All the items of one kind, as one row. */
export interface AttentionGroup {
  kind: AttentionItem['kind'];
  /** How many there are (the API lists at most ten of each kind). */
  count: number;
  title: string;
  detail: string;
  /** The properties involved, in order of first appearance. */
  properties: string[];
  /** The items listed (the first is the earliest). */
  items: AttentionItem[];
}

const ORDER: readonly AttentionItem['kind'][] = ['PAYOUT_MISSING', 'RECEIPT_MISSING', 'NO_PLAN', 'INVITE_PENDING'];

/** How several of a kind read: "3 stays waiting on payout", and what to do about them. */
const MANY: Record<AttentionItem['kind'], (n: number, first: AttentionItem) => { title: string; detail: string }> = {
  PAYOUT_MISSING: (n, first) => ({
    title: `${n} stays waiting on payout`,
    detail: `They aren’t counted until their payouts and cleaning fees are entered${
      first.date ? `, the earliest from ${shortDate(first.date)}` : ''
    }. Enter them all in one place.`,
  }),
  RECEIPT_MISSING: (n) => ({
    title: `${n} receipts missing`,
    detail: 'Owner-borne expenses need a receipt. Add them on Expenses.',
  }),
  NO_PLAN: (n) => ({
    title: `${n} properties have no plan`,
    detail: 'No TruPlan fee is charged until each has a management plan.',
  }),
  INVITE_PENDING: (n) => ({
    title: `${n} invites not accepted`,
    detail: 'Sent over a week ago. Resend or revoke them on Team.',
  }),
};

/**
 * Needs attention, one row per kind in a fixed order (payouts, receipts, plans, invites): a single item keeps the
 * API's own title and detail; several read as one ("3 stays waiting on payout"). Kinds with nothing are left out.
 */
export function attentionGroups(
  items: readonly AttentionItem[],
  counts: Partial<Record<AttentionItem['kind'], number>>,
): AttentionGroup[] {
  return ORDER.flatMap((kind) => {
    const listed = items.filter((i) => i.kind === kind);
    const count = counts[kind] ?? listed.length;
    const first = listed[0];
    if (count === 0 || !first) return [];
    const { title, detail } = count === 1 ? first : MANY[kind](count, first);
    const properties = [...new Set(listed.map((i) => i.propertyName).filter((n): n is string => Boolean(n)))];
    return [{ kind, count, title, detail, properties, items: listed }];
  });
}
