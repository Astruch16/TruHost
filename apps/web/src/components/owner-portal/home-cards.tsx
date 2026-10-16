import { Link } from '@tanstack/react-router';
import type { OwnerHome, OwnerMonth } from '@truhost/shared';
import { ArrowRight, CalendarRange, FileText, Moon, Sparkles } from 'lucide-react';
import { cx } from '../../lib/cx';
import { channelLabel } from '../../lib/format';
import { formatCents, splitCents } from '../../lib/money';
import { monthLabel, shortDate } from '../../lib/months';
import { barHeights, changeAmount, monthOnly, monthShort, widthOf } from '../../lib/owner';
import { formatSigned } from '../../lib/statements';
import { useMyGuide } from '../../lib/guide-context';
import { GUIDES } from '../../lib/guides';
import { Guide } from '../guide/guide';
import { ComingUpIllustration } from '../illustrations/coming-up';
import { RevenueIllustration } from '../illustrations/revenue';
import { Card } from '../ui/card';
import { EmptyState } from '../ui/empty-state';
import { MonthStepper } from '../ui/month-stepper';
import { Pill } from '../ui/pill';

/**
 * Earnings for the month the owner picks (the stepper): the released statement's figures when it's out, otherwise an
 * estimate from the stays booked, clearly marked. Before the first statement, it says when that arrives.
 */
export function MonthEarningsHero({
  month,
  onMonthChange,
  data,
  loading,
  firstStatementExpected,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  data: OwnerMonth | undefined;
  loading: boolean;
  /** Set while nothing has been released yet: the month the first statement is due. */
  firstStatementExpected: string | null;
}) {
  const guide = useMyGuide();
  const m = data;
  const { whole, cents } = splitCents(m?.netCents ?? 0);
  const single = m?.statementIds.length === 1;
  const released = m && m.basis !== 'ESTIMATE';
  const chip = !m
    ? null
    : m.basis === 'RELEASED'
      ? `Released ${shortDate(m.releasedOn!)}`
      : m.basis === 'MIXED'
        ? `Released ${shortDate(m.releasedOn!)} · ${m.estimatedProperties} estimated`
        : m.timing === 'CURRENT'
          ? 'In progress · estimated'
          : m.timing === 'FUTURE'
            ? 'Booked so far · estimated'
            : 'Not released yet · estimated';
  return (
    <section
      aria-labelledby="month-earnings"
      className="relative overflow-hidden rounded-card bg-primary px-6 py-6 text-primary-ink @2xl/content:px-8 @2xl/content:py-7"
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/5" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-[-6rem] size-64 rounded-full bg-white/5"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="month-earnings" className="text-sm font-semibold tracking-[0.12em] text-primary-ink-muted uppercase">
            {monthLabel(month)} {released ? 'statement' : 'earnings'}
          </h2>
          {chip && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-primary-ink">
              <span
                aria-hidden
                className={cx('size-1.5 rounded-full', released ? 'bg-sage-light' : 'bg-amber-light')}
              />
              {chip}
            </span>
          )}
        </div>
        <MonthStepper month={month} onChange={onMonthChange} />
      </div>
      <div className={cx('relative transition-opacity', loading && 'opacity-60')} aria-busy={loading || undefined}>
        <p className="mt-4 text-sm text-primary-ink-muted">{released ? 'Net to you' : 'Estimated net to you'}</p>
        <p className="figure text-[2.75rem] leading-none font-bold tracking-[-0.03em] @2xl/content:text-[3.5rem]">
          {m ? (
            <>
              {whole}
              <span className="text-[0.5em] text-primary-ink-muted">{cents}</span>
            </>
          ) : (
            <span className="inline-block h-12 w-56 animate-pulse rounded-lg bg-white/10" />
          )}
        </p>
        {m && (
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Stat label="Gross revenue" value={formatCents(m.grossCents)} />
            <Stat
              label="TruPlan fee"
              value={m.managementFeeCents > 0 ? `−${formatCents(m.managementFeeCents)}` : '$0.00'}
            />
            <Stat label="Expenses" value={m.expensesCents > 0 ? `−${formatCents(m.expensesCents)}` : '$0.00'} />
            {m.adjustmentsCents !== 0 && <Stat label="Adjustments" value={formatSigned(m.adjustmentsCents)} />}
            <Stat label="Nights booked" value={String(m.nightsBooked)} />
            <Stat label={`vs ${monthOnly(m.change.month)}`} value={changeAmount(m.change.changeCents)} />
          </dl>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {m && m.statementIds.length > 0 ? (
            <Link
              to={single ? '/owner/statements/$statementId' : '/owner/statements'}
              params={single ? { statementId: m.statementIds[0]! } : undefined}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-ink-muted"
            >
              <FileText aria-hidden className="size-4" /> View statement
            </Link>
          ) : (
            <Link
              to="/owner/calendar"
              search={{ month }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-ink-muted"
            >
              <CalendarRange aria-hidden className="size-4" /> See the stays
            </Link>
          )}
          {m && !released && (
            <p className="text-sm text-primary-ink-muted">
              {firstStatementExpected && m.timing !== 'FUTURE'
                ? `Your first statement arrives in early ${monthOnly(firstStatementExpected)}.`
                : m.timing === 'PAST'
                  ? 'No statement released for this month yet: estimated from its stays and expenses.'
                  : 'Figures change as stays are booked and paid.'}
            </p>
          )}
        </div>
      </div>
      {firstStatementExpected && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-6 bottom-5 hidden size-20 place-items-center rounded-full @3xl/content:grid"
          style={{ backgroundColor: GUIDES[guide].tint }}
        >
          <Guide character={guide} pose="waving" size={72} />
        </span>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-primary-ink-muted">{label}</dt>
      <dd className="figure font-semibold">{value}</dd>
    </div>
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
