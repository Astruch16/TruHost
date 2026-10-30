import { CLEAN_STATUS_LABELS, type CleanStatus } from '@truhost/shared';
import { CLEAN_STATUS_TONE } from '../../lib/cleans';
import { Pill } from '../ui/pill';

/** A clean's status. One under way pulses: it's happening now. */
export function CleanStatusPill({ status, glass }: { status: CleanStatus; glass?: boolean }) {
  return (
    <Pill tone={CLEAN_STATUS_TONE[status]} pulse={status === 'IN_PROGRESS'} glass={glass}>
      {CLEAN_STATUS_LABELS[status]}
    </Pill>
  );
}
