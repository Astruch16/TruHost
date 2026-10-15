import type { DamageReport, DamageSeverity, DamageStatus } from '@truhost/shared';
import type { PillTone } from './styles';

export const SEVERITY_TONE: Record<DamageSeverity, PillTone> = { MINOR: 'blue', MODERATE: 'amber', SEVERE: 'danger' };

export const STATUS_TONE: Record<DamageStatus, PillTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'lavender',
  ACKNOWLEDGED: 'blue',
  CLAIM_FILED: 'amber',
  RESOLVED: 'sage',
};

const DAY = 86_400_000;
const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/**
 * Where a report's AirCover claim window stands, for a report not yet claimed or closed: "3 days left" (urgent when
 * 3 or fewer), "Last day today", or "Window closed". Null when there's no deadline or the claim is filed or done.
 */
export function claimWindow(
  report: Pick<DamageReport, 'claimDeadline' | 'status'>,
  today: string,
): { label: string; urgent: boolean; closed: boolean } | null {
  if (!report.claimDeadline || report.status === 'CLAIM_FILED' || report.status === 'RESOLVED') return null;
  const left = days(today, report.claimDeadline);
  if (left < 0) return { label: 'Claim window closed', urgent: false, closed: true };
  if (left === 0) return { label: 'Last day to claim', urgent: true, closed: false };
  return { label: `${left} day${left === 1 ? '' : 's'} to claim`, urgent: left <= 3, closed: false };
}

/** The steps a report goes through, with when each was reached (null: not yet). */
export function damageTimeline(
  r: Pick<DamageReport, 'submittedAt' | 'acknowledgedAt' | 'claimFiledAt' | 'resolvedAt'>,
) {
  return [
    { key: 'SUBMITTED', label: 'Reported', at: r.submittedAt },
    { key: 'ACKNOWLEDGED', label: 'Acknowledged', at: r.acknowledgedAt },
    { key: 'CLAIM_FILED', label: 'Claim filed', at: r.claimFiledAt },
    { key: 'RESOLVED', label: 'Resolved', at: r.resolvedAt },
  ] as const;
}

/** Open: not resolved yet. */
export const isOpen = (r: Pick<DamageReport, 'status'>) => r.status !== 'RESOLVED';
