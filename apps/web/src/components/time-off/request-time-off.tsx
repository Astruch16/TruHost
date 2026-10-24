import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import { MAX_TIME_OFF_DAYS, TIME_OFF_REASON_LABELS, type TimeOffReason, type TimeOffRequest } from '@truhost/shared';
import { useApi } from '../../lib/api-context';
import { cx } from '../../lib/cx';
import { todayIso } from '../../lib/dates';
import { timeOffDates } from '../../lib/time-off';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DatePicker } from '../ui/date-picker';
import { Field } from '../ui/field';
import { Textarea } from '../ui/input';
import { SuccessNotice } from '../ui/success-notice';

const REASONS: { value: TimeOffReason; hint: string }[] = [
  { value: 'HOLIDAY', hint: 'A trip or a holiday' },
  { value: 'TIME_OFF', hint: 'Personal or sick days' },
  { value: 'OTHER_WORK', hint: 'Other cleans or another job' },
  { value: 'OTHER', hint: 'Anything else' },
];

const DAY_MS = 86_400_000;
const daysIn = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / DAY_MS + 1;

/**
 * A cleaner asks for days to be kept free: the first and last day, why, and an optional note. Sending tells TruHost
 * (never owners); the request shows as waiting until TruHost approves or declines it.
 */
export function RequestTimeOff() {
  const api = useApi();
  const qc = useQueryClient();
  const today = todayIso();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState<TimeOffReason | null>(null);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState<TimeOffRequest | null>(null);
  const days = start && end && end >= start ? daysIn(start, end) : 0;
  const problems = {
    start: !start ? 'Pick the first day' : undefined,
    end: !end ? 'Pick the last day' : end < start ? 'The last day can’t be before the first' : undefined,
    reason: !reason ? 'Say what it’s for' : undefined,
    days: days > MAX_TIME_OFF_DAYS ? `Ask for at most ${MAX_TIME_OFF_DAYS} days at a time` : undefined,
  };
  const valid = !Object.values(problems).some(Boolean);
  const send = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/time-off', {
          body: { startDate: start, endDate: end, reason: reason!, note: note.trim() || null },
        }),
      ),
    onSuccess: (r) => {
      setSent(r);
      setStart('');
      setEnd('');
      setReason(null);
      setNote('');
      setTouched(false);
      void qc.invalidateQueries({ queryKey: ['time-off'] });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (valid) send.mutate();
  };

  return (
    <Card title="Ask for time off" description="TruHost will see it and let you know here.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {sent && (
          <SuccessNotice title="Request sent.">
            TruHost has been told you’d like {timeOffDates(sent)} off.
          </SuccessNotice>
        )}
        <div className="grid grid-cols-1 gap-4 @md/content:grid-cols-2">
          <Field label="First day" error={touched ? problems.start : undefined} required>
            <DatePicker
              value={start}
              onChange={(v) => {
                setStart(v);
                if (!end || end < v) setEnd(v);
              }}
              min={today}
              aria-label="First day"
            />
          </Field>
          <Field
            label="Last day"
            error={touched ? (problems.end ?? problems.days) : undefined}
            hint={days ? `${days} day${days === 1 ? '' : 's'}` : undefined}
            required
          >
            <DatePicker value={end} onChange={setEnd} min={start || today} aria-label="Last day" />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            What it’s for <span className="text-danger-deep">*</span>
          </legend>
          <div role="radiogroup" aria-label="What it’s for" className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                onClick={() => setReason(r.value)}
                className={cx(
                  'flex flex-col items-start rounded-inner border px-3.5 py-2.5 text-left transition-colors',
                  reason === r.value
                    ? 'border-primary bg-sage-tint/40 ring-1 ring-primary'
                    : 'border-line bg-surface hover:bg-ground',
                )}
              >
                <span className="font-semibold text-ink">{TIME_OFF_REASON_LABELS[r.value]}</span>
                <span className="text-xs text-muted">{r.hint}</span>
              </button>
            ))}
          </div>
          {touched && problems.reason && <p className="mt-1.5 text-sm text-danger-deep">{problems.reason}</p>}
        </fieldset>
        <Field label="Note for TruHost" hint="Optional">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. I can still do mornings"
          />
        </Field>
        <ErrorAlert error={send.error} />
        <div>
          <Button type="submit" loading={send.isPending}>
            Send request
          </Button>
        </div>
      </form>
    </Card>
  );
}
