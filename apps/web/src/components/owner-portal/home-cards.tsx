import { Link } from '@tanstack/react-router';
import type { OwnerHome } from '@truhost/shared';
import { ArrowRight, FileText, Moon, Sparkles } from 'lucide-react';
import { cx } from '../../lib/cx';
import { channelLabel } from '../../lib/format';
import { formatCents, splitCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { barHeights, changeText, monthOnly, monthShort, widthOf } from '../../lib/owner';
import { formatSigned } from '../../lib/statements';
import { useMyGuide } from '../../lib/guide-context';
import { GUIDES } from '../../lib/guides';
import { Guide } from '../guide/guide';
import { ComingUpIllustration } from '../illustrations/coming-up';
import { RevenueIllustration } from '../illustrations/revenue';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { Pill } from '../ui/pill';

/** The latest released statement: what was sent, when, and how it compares with the month before. */
export function LatestStatementHero({ latest }: { latest: NonNullable<OwnerHome['latest']> }) {
  const { whole, cents } = splitCents(latest.netCents);
  const single = latest.statementIds.length === 1;
  return (
    <section
      aria-labelledby="latest-statement"
      className="relative overflow-hidden rounded-card bg-primary px-6 py-6 text-primary-ink @2xl/content:px-8 @2xl/content:py-7"
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/5" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-[-6rem] size-64 rounded-full bg-white/5"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <h2 id="latest-statement" className="text-sm font-semibold tracking-[0.12em] text-primary-ink-muted uppercase">
          {monthLabel(latest.month)} statement
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-primary-ink">
          <span aria-hidden className="size-1.5 rounded-full bg-sage-light" />
          Released {shortDate(latest.releasedOn)}
        </span>
      </div>
      <p className="relative mt-4 text-sm text-primary-ink-muted">Net to you</p>
      <p className="figure relative text-[2.75rem] leading-none font-bold tracking-[-0.03em] @2xl/content:text-[3.5rem]">
        {whole}
        <span className="text-[0.5em] text-primary-ink-muted">{cents}</span>
      </p>
      <dl className="relative mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div>
          <dt className="text-primary-ink-muted">Gross revenue</dt>
          <dd className="figure font-semibold">{formatCents(latest.grossCents)}</dd>
        </div>
        <div>
          <dt className="text-primary-ink-muted">Nights booked</dt>
          <dd className="figure font-semibold">{latest.nightsBooked}</dd>
        </div>
        {latest.change && (
          <div>
            <dt className="text-primary-ink-muted">Change</dt>
            <dd className="figure font-semibold">{changeText(latest.change)}</dd>
          </div>
        )}
      </dl>
      <Link
        to={single ? '/owner/statements/$statementId' : '/owner/statements'}
        params={single ? { statementId: latest.statementIds[0]! } : undefined}
        className="relative mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-ink-muted"
      >
        <FileText aria-hidden className="size-4" /> View statement
      </Link>
    </section>
  );
}

/** Before the first release: what to expect, with the user's guide. */
export function FirstStatementHero({ expected }: { expected: string }) {
  const guide = useMyGuide();
  return (
    <section className="flex flex-col items-start gap-5 rounded-card bg-primary px-6 py-6 text-primary-ink @2xl/content:flex-row @2xl/content:items-center @2xl/content:px-8">
      <span
        className="grid size-20 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: GUIDES[guide].tint }}
      >
        <Guide character={guide} pose="waving" size={72} />
      </span>
      <div>
        <h2 className="text-xl font-bold">Your first statement is on its way</h2>
        <p className="mt-1 max-w-xl text-sm text-primary-ink-muted">
          Statements arrive after each month ends, once TruHost has checked every payout and receipt. Your first one is
          expected in early {monthOnly(expected)}. Until then, “This month so far” shows how the month is going.
        </p>
      </div>
    </section>
  );
}

/** The month in progress, estimated from the stays booked so far. */
export function ThisMonthCard({ m }: { m: OwnerHome['thisMonth'] }) {
  const { whole, cents } = splitCents(m.estimatedNetCents);
  const free = Math.max(m.daysInMonth - m.nightsBooked, 0);
  return (
    <Card
      title="This month so far"
      description={`${monthLabel(m.month)}, from the stays booked`}
      actions={<Pill tone="amber">Estimated</Pill>}
    >
      <p className="text-sm text-muted">Estimated net to you</p>
      <p className="figure text-[2rem] leading-tight font-bold tracking-tight text-ink">
        {whole}
        <span className="text-[0.6em] text-muted">{cents}</span>
      </p>
      <div className="mt-4">
        <div
          role="img"
          aria-label={`${m.nightsStayed} nights stayed and ${m.nightsUpcoming} still to come, of ${m.daysInMonth} in the month`}
          className="flex h-3 gap-1 overflow-hidden rounded-full bg-line-soft"
        >
          {m.nightsStayed > 0 && (
            <span
              className="h-full rounded-l-full bg-primary"
              style={{ width: `${widthOf(m.nightsStayed, m.daysInMonth)}%` }}
            />
          )}
          {m.nightsUpcoming > 0 && (
            <span
              className={cx('h-full bg-sage-light', m.nightsStayed === 0 && 'rounded-l-full')}
              style={{ width: `${widthOf(m.nightsUpcoming, m.daysInMonth)}%` }}
            />
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-primary" />
            <strong className="figure text-ink">{m.nightsStayed}</strong> nights stayed
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-sage-light" />
            <strong className="figure text-ink">{m.nightsUpcoming}</strong> to come
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-line" />
            <strong className="figure text-ink">{free}</strong> open
          </li>
        </ul>
      </div>
      <p className="mt-4 flex items-center gap-2 rounded-inner bg-ground px-3.5 py-2.5 text-sm text-ink">
        <Sparkles aria-hidden className="size-4 shrink-0 text-amber-deep" />
        Statement ready in early {monthOnly(m.statementExpected)}.
        {m.pendingPayouts > 0 &&
          ` ${m.pendingPayouts === 1 ? 'One payout hasn’t' : `${m.pendingPayouts} payouts haven’t`} arrived yet, so ${m.pendingPayouts === 1 ? 'it isn’t' : 'they aren’t'} counted.`}
      </p>
    </Card>
  );
}

/** Net to you by month this year: released statements, this month's estimate dashed, months still to come empty. */
export function NetByMonthChart({ months }: { months: OwnerHome['netByMonth'] }) {
  const heights = barHeights(months.map((m) => m.netCents));
  if (!months.some((m) => m.state === 'RELEASED')) {
    return (
      <Card title="Net to you by month">
        <EmptyState size="compact" illustration={<RevenueIllustration />} title="No released months yet">
          Each month appears here once its statement is released.
        </EmptyState>
      </Card>
    );
  }
  return (
    <Card title="Net to you by month" description="Released statements, and this month so far">
      <ul className="flex h-48 items-end gap-1.5 @2xl/content:gap-3" aria-label="Net to you by month">
        {months.map((m, i) => {
          const h = heights[i];
          const label =
            m.state === 'PENDING'
              ? `${monthLabel(m.month)}: not released yet`
              : `${monthLabel(m.month)}: ${formatCents(m.netCents!)}${m.state === 'IN_PROGRESS' ? ' so far (estimated)' : ''}`;
          return (
            <li key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <span className="sr-only">{label}</span>
              <span aria-hidden className="figure hidden text-[11px] font-semibold text-muted @3xl/content:block">
                {m.netCents !== null && m.state === 'RELEASED' ? formatCentsCompact(m.netCents) : ''}
              </span>
              <span
                aria-hidden
                title={label}
                className={cx(
                  'w-full max-w-10 rounded-t-md',
                  m.state === 'RELEASED' && 'bg-primary',
                  m.state === 'IN_PROGRESS' && 'border-2 border-dashed border-primary/60 bg-sage-tint',
                  m.state === 'PENDING' && 'bg-line-soft',
                )}
                style={{ height: h === null ? '4px' : `${h}%` }}
              />
              <span aria-hidden className="text-[11px] text-muted">
                {monthShort(m.month)}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-primary" /> Released
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm border border-dashed border-primary/60 bg-sage-tint" /> In
          progress
        </li>
      </ul>
    </Card>
  );
}

/** "$2.8k" above a bar (screen text only). */
function formatCentsCompact(cents: number): string {
  return cents >= 100_000 ? `$${(cents / 100_000).toFixed(1)}k` : formatCents(cents).replace(/\.\d\d$/, '');
}

/** The next stays: guest stays by channel, owner stays marked. */
export function ComingUpCard({ items, showProperty }: { items: OwnerHome['comingUp']; showProperty: boolean }) {
  return (
    <Card
      title="Coming up"
      actions={
        <Link
          to="/owner/calendar"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Calendar <ArrowRight aria-hidden className="size-4" />
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState size="compact" illustration={<ComingUpIllustration />} title="Nothing booked yet">
          New stays show up here as soon as they’re booked.
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {items.map((c) => (
            <li
              key={c.bookingId}
              className="flex items-center gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
            >
              <span className="flex w-12 shrink-0 flex-col items-center rounded-inner bg-ground py-1.5 text-center">
                <span className="text-[11px] font-semibold text-muted uppercase">
                  {shortDate(c.checkInDate).split(' ')[0]}
                </span>
                <span className="figure text-lg leading-none font-bold text-ink">
                  {shortDate(c.checkInDate).split(' ')[1]}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  {c.kind === 'OWNER_STAY' ? 'Your stay' : `${channelLabel(c.channel ?? 'OTHER')} guest`}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Moon aria-hidden className="size-3" />
                  {c.nights} night{c.nights === 1 ? '' : 's'} · to {shortDate(c.checkOutDate)}
                  {showProperty ? ` · ${c.property.name}` : ''}
                </p>
              </div>
              {c.kind === 'OWNER_STAY' && <Pill tone="lavender">Owner stay</Pill>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Recent owner-paid expenses and adjustments, in plain words. */
export function GoodToKnowCard({
  items,
  showProperty,
  onViewReceipt,
}: {
  items: OwnerHome['goodToKnow'];
  showProperty: boolean;
  onViewReceipt: (fileId: string) => void;
}) {
  return (
    <Card title="Good to know" description="Recent expenses paid from your earnings, and statement adjustments">
      <ul className="flex flex-col">
        {items.map((g) => (
          <li
            key={g.id}
            className="flex items-start justify-between gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{g.title}</p>
              <p className="text-xs text-muted">
                {shortDate(g.date)} · {g.detail}
                {showProperty ? ` · ${g.property.name}` : ''}
              </p>
              {g.receiptFileId && (
                <button
                  type="button"
                  onClick={() => onViewReceipt(g.receiptFileId!)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <FileText aria-hidden className="size-3.5" /> Receipt
                </button>
              )}
              {g.statementId && (
                <Link
                  to="/owner/statements/$statementId"
                  params={{ statementId: g.statementId }}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <FileText aria-hidden className="size-3.5" /> Statement
                </Link>
              )}
            </div>
            <span className={cx('figure shrink-0 font-semibold', g.amountCents < 0 ? 'text-ink' : 'text-sage-deep')}>
              {formatSigned(g.amountCents)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
