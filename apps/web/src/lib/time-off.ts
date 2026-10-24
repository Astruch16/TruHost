import type { TimeOffRequest, TimeOffStatus } from '@truhost/shared';
import { dayLabel } from './dashboard-format';

/** "Mon, Dec 22 – Fri, Jan 2", or one day. */
export const timeOffDates = (r: Pick<TimeOffRequest, 'startDate' | 'endDate'>) =>
  r.startDate === r.endDate ? dayLabel(r.startDate) : `${dayLabel(r.startDate)} – ${dayLabel(r.endDate)}`;

export const TIME_OFF_TONE: Record<TimeOffStatus, 'amber' | 'sage' | 'danger' | 'neutral'> = {
  PENDING: 'amber',
  APPROVED: 'sage',
  DECLINED: 'danger',
  CANCELLED: 'neutral',
};

/** Every day of the approved requests, for marking a calendar. */
export function daysOff(requests: readonly Pick<TimeOffRequest, 'startDate' | 'endDate' | 'status'>[]): Set<string> {
  const days = new Set<string>();
  for (const r of requests) {
    if (r.status !== 'APPROVED') continue;
    for (let d = r.startDate; d <= r.endDate; d = nextDay(d)) days.add(d);
  }
  return days;
}

const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
