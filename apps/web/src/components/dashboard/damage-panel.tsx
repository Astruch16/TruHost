import { Link } from '@tanstack/react-router';
import { DAMAGE_STATUS_LABELS, type DamageReport } from '@truhost/shared';
import { TriangleAlert } from 'lucide-react';
import { cx } from '../../lib/cx';
import { claimWindow, STATUS_TONE } from '../../lib/damage';
import { shortDate } from '../../lib/months';
import { DamageAlertIcon, DamageIllustration } from '../illustrations/damage';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Pill } from '../ui/pill';

/** The most this card lists; Damage has the rest. */
const SHOWN = 4;

/**
 * Dashboard: open damage reports (newest first), each with where it stands and how long is left to claim, and a way to
 * report more. "See all" opens Damage.
 */
export function DamagePanel({
  items,
  today,
  showProperty,
  onReport,
  onOpen,
}: {
  /** Open (unresolved) reports. */
  items: DamageReport[];
  today: string;
  showProperty: boolean;
  onReport: () => void;
  onOpen: (id: string) => void;
}) {
  const shown = items.slice(0, SHOWN);
  return (
    <Card
      title="Damage reports"
      description={items.length ? `${items.length} open` : undefined}
      actions={
        <Link to="/admin/damage" className="rounded-control-sm text-sm font-semibold text-primary hover:underline">
          See all
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <EmptyState size="compact" illustration={<DamageIllustration />} title="No open damage">
            Damage a cleaner or TruHost reports shows up here, with how long is left to claim.
          </EmptyState>
        ) : (
          <ul className="flex flex-col">
            {shown.map((r) => {
              const window = claimWindow(r, today);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-ground focus-visible:bg-ground"
                  >
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-inner bg-ground">
                      {r.coverThumbUrl ? (
                        <img src={r.coverThumbUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <DamageAlertIcon size={32} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{r.title}</span>
                      <span className="block truncate text-sm text-muted">
                        {[showProperty ? r.property.name : null, `Found ${shortDate(r.discoveredOn)}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <Pill tone={STATUS_TONE[r.status]}>{DAMAGE_STATUS_LABELS[r.status]}</Pill>
                        {window && (
                          <span
                            className={cx(
                              'text-xs font-semibold',
                              window.closed ? 'text-muted' : window.urgent ? 'text-danger-deep' : 'text-amber-deep',
                            )}
                          >
                            {window.label}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > shown.length && (
          <p className="text-sm text-muted">
            +{items.length - shown.length} more on{' '}
            <Link to="/admin/damage" className="font-semibold text-primary hover:underline">
              Damage
            </Link>
          </p>
        )}
        <Button variant="secondary" block onClick={onReport}>
          <TriangleAlert aria-hidden className="size-4" /> Report damage
        </Button>
      </div>
    </Card>
  );
}
