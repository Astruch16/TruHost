import { DAMAGE_SEVERITY_LABELS, DAMAGE_STATUS_LABELS, type DamageReport } from '@truhost/shared';
import { Camera, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { claimWindow, SEVERITY_TONE, STATUS_TONE } from '../../lib/damage';
import { shortDate } from '../../lib/months';
import { DamageAlertIcon } from '../illustrations/damage';
import { Pill } from '../ui/pill';

/**
 * Damage reports as rows: a photo, what it is, how bad, where it stands, when it was found and after which stay, and
 * how long is left to claim. Each opens the report.
 */
export function DamageList({
  items,
  today,
  showProperty,
  onOpen,
}: {
  items: DamageReport[];
  today: string;
  showProperty: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {items.map((r) => {
        const window = claimWindow(r, today);
        const stay = r.booking
          ? `${r.booking.guestName ?? 'Stay'} ${shortDate(r.booking.checkInDate)}–${shortDate(r.booking.checkOutDate)}`
          : null;
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-3 text-left transition-colors hover:bg-ground focus-visible:bg-ground"
            >
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-inner bg-ground">
                {r.coverThumbUrl ? (
                  <img src={r.coverThumbUrl} alt="" className="size-full object-cover" />
                ) : (
                  <DamageAlertIcon size={36} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-ink">{r.title}</span>
                  <Pill tone={STATUS_TONE[r.status]}>{DAMAGE_STATUS_LABELS[r.status]}</Pill>
                  <Pill tone={SEVERITY_TONE[r.severity]}>{DAMAGE_SEVERITY_LABELS[r.severity]}</Pill>
                </span>
                <span className="mt-0.5 block text-sm text-muted">
                  {[
                    showProperty ? r.property.name : null,
                    `Found ${shortDate(r.discoveredOn)}`,
                    r.room?.displayName,
                    stay,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Camera aria-hidden className="size-3.5" /> {r.photoCount} photo{r.photoCount === 1 ? '' : 's'}
                  </span>
                  {window && (
                    <span
                      className={cx(
                        'font-semibold',
                        window.closed ? 'text-muted' : window.urgent ? 'text-danger-deep' : 'text-amber-deep',
                      )}
                    >
                      {window.label}
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted group-hover:text-ink" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
