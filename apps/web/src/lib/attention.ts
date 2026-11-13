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
  /** For several stays or receipts: the earliest one's date ("Nov 1"). */
  since: string | null;
  /** The items listed (the first is the earliest). */
  items: AttentionItem[];
}

const ORDER: readonly AttentionItem['kind'][] = ['PAYOUT_MISSING', 'RECEIPT_MISSING', 'NO_PLAN', 'INVITE_PENDING'];

/** How several of a kind read: the title (the count is shown beside it) and one line on what to do. */
const MANY: Record<AttentionItem['kind'], { title: string; detail: string }> = {
  PAYOUT_MISSING: { title: 'Stays waiting on payout', detail: 'Enter their payouts and cleaning fees to count them.' },
  RECEIPT_MISSING: { title: 'Receipts missing', detail: 'Owner-borne expenses need a receipt.' },
  NO_PLAN: { title: 'Properties without a plan', detail: 'No TruPlan fee is charged until each has a plan.' },
  INVITE_PENDING: { title: 'Invites not accepted', detail: 'Sent over a week ago. Resend or revoke them on Team.' },
};

/**
 * Needs attention, one row per kind in a fixed order (payouts, receipts, plans, invites): a single item keeps the
 * API's own title and detail; several read as one ("Stays waiting on payout", with the count beside it), with the
 * earliest date for stays and receipts. Kinds with nothing are left out.
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
    const { title, detail } = count === 1 ? first : MANY[kind];
    const properties = [...new Set(listed.map((i) => i.propertyName).filter((n): n is string => Boolean(n)))];
    const dated = count > 1 && (kind === 'PAYOUT_MISSING' || kind === 'RECEIPT_MISSING') && first.date;
    const since = dated ? shortDate(dated) : null;
    return [{ kind, count, title, detail, properties, since, items: listed }];
  });
}
