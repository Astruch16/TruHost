import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './ui/button';
import { ErrorAlert } from './ui/alert';
import { Field } from './ui/field';
import { Input, Textarea } from './ui/input';
import { fieldErrors } from '../lib/errors';
import { centsToInput, parseDollarsToCents } from '../lib/money';
import type { PropertyFormValues } from '../lib/property-values';

type Text = Record<
  | 'name'
  | 'description'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'postalCode'
  | 'bedrooms'
  | 'bathrooms'
  | 'halfBathrooms'
  | 'maxGuests'
  | 'checkInTime'
  | 'checkOutTime'
  | 'airbnbUrl'
  | 'vrboUrl'
  | 'bookingComUrl'
  | 'provincialRegistrationNumber'
  | 'businessLicenceNumber'
  | 'pay'
  | 'cleaningFee',
  string
>;

const str = (v: string | number | null) => (v === null ? '' : String(v));

/** One titled group of fields. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-line-soft pt-5 first:border-t-0 first:pt-0 @lg/form:grid-cols-[11rem_minmax(0,1fr)] @lg/form:gap-6"
    >
      <div className="@lg/form:pt-1">
        <h3 id={id} className="text-sm font-semibold text-ink">
          {title}
        </h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="grid min-w-0 gap-4 @xl/form:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Create and edit a property, in sections: basics, address, layout, stays, listings, registration, money. Empty
 * optional fields are sent as null; numbers and amounts are checked here before the API checks everything again.
 */
export function PropertyForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: PropertyFormValues;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: PropertyFormValues) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<Text>({
    name: initial.name,
    description: str(initial.description),
    addressLine1: initial.addressLine1,
    addressLine2: str(initial.addressLine2),
    city: initial.city,
    postalCode: initial.postalCode,
    bedrooms: str(initial.bedrooms),
    bathrooms: str(initial.bathrooms),
    halfBathrooms: str(initial.halfBathrooms),
    maxGuests: str(initial.maxGuests),
    checkInTime: initial.checkInTime,
    checkOutTime: initial.checkOutTime,
    airbnbUrl: str(initial.airbnbUrl),
    vrboUrl: str(initial.vrboUrl),
    bookingComUrl: str(initial.bookingComUrl),
    provincialRegistrationNumber: str(initial.provincialRegistrationNumber),
    businessLicenceNumber: str(initial.businessLicenceNumber),
    pay: centsToInput(initial.defaultCleanerPayCents),
    cleaningFee: centsToInput(initial.standardCleaningFeeCents),
  });
  const [local, setLocal] = useState<Partial<Record<keyof Text, string>>>({});
  const server = fieldErrors(error);
  const errorFor = (key: keyof Text, apiKey: string = key) => local[key] ?? server[apiKey];
  const set = (key: keyof Text) => (e: { target: { value: string } }) => setV({ ...v, [key]: e.target.value });
  const orNull = (s: string) => (s.trim() ? s.trim() : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problems: Partial<Record<keyof Text, string>> = {};
    const whole = (key: 'bedrooms' | 'bathrooms' | 'halfBathrooms' | 'maxGuests') => {
      const s = v[key].trim();
      if (!s) return null;
      if (!/^\d{1,3}$/.test(s)) {
        problems[key] = 'Enter a whole number';
        return null;
      }
      return Number(s);
    };
    const counts = {
      bedrooms: whole('bedrooms'),
      bathrooms: whole('bathrooms'),
      halfBathrooms: whole('halfBathrooms'),
      maxGuests: whole('maxGuests'),
    };
    const pay = parseDollarsToCents(v.pay);
    const fee = parseDollarsToCents(v.cleaningFee);
    if (pay === null) problems.pay = 'Enter an amount like 90 or 90.50';
    if (fee === null) problems.cleaningFee = 'Enter an amount like 90 or 90.50';
    setLocal(problems);
    if (Object.keys(problems).length > 0 || pay === null || fee === null) return;
    onSubmit({
      name: v.name.trim(),
      description: orNull(v.description),
      addressLine1: v.addressLine1,
      addressLine2: orNull(v.addressLine2),
      city: v.city,
      postalCode: v.postalCode,
      ...counts,
      checkInTime: v.checkInTime,
      checkOutTime: v.checkOutTime,
      airbnbUrl: orNull(v.airbnbUrl),
      vrboUrl: orNull(v.vrboUrl),
      bookingComUrl: orNull(v.bookingComUrl),
      provincialRegistrationNumber: orNull(v.provincialRegistrationNumber),
      businessLicenceNumber: orNull(v.businessLicenceNumber),
      defaultCleanerPayCents: pay,
      standardCleaningFeeCents: fee,
    });
  };

  const hasFieldErrors = Object.keys(server).length > 0 || Object.keys(local).length > 0;

  return (
    <form onSubmit={submit} noValidate className="@container/form flex flex-col gap-5">
      <Section title="Basics" hint="How the team refers to it.">
        <Field label="Name" error={errorFor('name')} hint="Internal nickname, e.g. “Cedar Suite”" required>
          <Input value={v.name} onChange={set('name')} autoComplete="off" />
        </Field>
        <Field
          label="Description"
          error={errorFor('description')}
          hint="A line or two for owners and cleaners."
          className="@xl/form:col-span-2"
        >
          <Textarea value={v.description} onChange={set('description')} rows={3} maxLength={1000} />
        </Field>
      </Section>

      <Section title="Address">
        <Field label="Street address" error={errorFor('addressLine1')} required className="@xl/form:col-span-2">
          <Input value={v.addressLine1} onChange={set('addressLine1')} autoComplete="address-line1" />
        </Field>
        <Field label="Unit / line 2" error={errorFor('addressLine2')}>
          <Input value={v.addressLine2} onChange={set('addressLine2')} autoComplete="address-line2" />
        </Field>
        <Field label="City" error={errorFor('city')} required>
          <Input value={v.city} onChange={set('city')} autoComplete="address-level2" />
        </Field>
        <Field label="Postal code" error={errorFor('postalCode')} required>
          <Input value={v.postalCode} onChange={set('postalCode')} autoComplete="postal-code" />
        </Field>
      </Section>

      <Section title="Layout" hint="Leave blank what you don’t know yet.">
        <div className="grid grid-cols-2 gap-4 @xl/form:col-span-2 @xl/form:grid-cols-4">
          <Field label="Bedrooms" error={errorFor('bedrooms')} hint="0 for a studio">
            <Input value={v.bedrooms} onChange={set('bedrooms')} inputMode="numeric" className="figure" />
          </Field>
          <Field label="Bathrooms" error={errorFor('bathrooms')}>
            <Input value={v.bathrooms} onChange={set('bathrooms')} inputMode="numeric" className="figure" />
          </Field>
          <Field label="Half baths" error={errorFor('halfBathrooms')}>
            <Input value={v.halfBathrooms} onChange={set('halfBathrooms')} inputMode="numeric" className="figure" />
          </Field>
          <Field label="Sleeps" error={errorFor('maxGuests')} hint="Max guests">
            <Input value={v.maxGuests} onChange={set('maxGuests')} inputMode="numeric" className="figure" />
          </Field>
        </div>
      </Section>

      <Section title="Stays" hint="Default times for cleans and the calendar.">
        <Field label="Check-in" error={errorFor('checkInTime')} required>
          <Input type="time" value={v.checkInTime} onChange={set('checkInTime')} />
        </Field>
        <Field label="Check-out" error={errorFor('checkOutTime')} required>
          <Input type="time" value={v.checkOutTime} onChange={set('checkOutTime')} />
        </Field>
      </Section>

      <Section title="Listings" hint="Links to the public listing pages.">
        <Field label="Airbnb" error={errorFor('airbnbUrl')} className="@xl/form:col-span-2">
          <Input
            value={v.airbnbUrl}
            onChange={set('airbnbUrl')}
            type="url"
            inputMode="url"
            placeholder="https://www.airbnb.ca/rooms/…"
          />
        </Field>
        <Field label="VRBO" error={errorFor('vrboUrl')} className="@xl/form:col-span-2">
          <Input
            value={v.vrboUrl}
            onChange={set('vrboUrl')}
            type="url"
            inputMode="url"
            placeholder="https://www.vrbo.com/…"
          />
        </Field>
        <Field label="Booking.com" error={errorFor('bookingComUrl')} className="@xl/form:col-span-2">
          <Input
            value={v.bookingComUrl}
            onChange={set('bookingComUrl')}
            type="url"
            inputMode="url"
            placeholder="https://www.booking.com/hotel/ca/…"
          />
        </Field>
      </Section>

      <Section title="Registration">
        <Field label="BC STR registration #" error={errorFor('provincialRegistrationNumber')}>
          <Input value={v.provincialRegistrationNumber} onChange={set('provincialRegistrationNumber')} />
        </Field>
        <Field label="Business licence #" error={errorFor('businessLicenceNumber')}>
          <Input value={v.businessLicenceNumber} onChange={set('businessLicenceNumber')} />
        </Field>
      </Section>

      <Section title="Money" hint="Defaults for new stays and cleans.">
        <Field
          label="Standard cleaning fee ($)"
          error={errorFor('cleaningFee', 'standardCleaningFeeCents')}
          hint="What guests are normally charged. Owners pay this after an owner stay."
          required
        >
          <Input value={v.cleaningFee} onChange={set('cleaningFee')} inputMode="decimal" className="figure" />
        </Field>
        <Field
          label="Cleaner pay per clean ($)"
          error={errorFor('pay', 'defaultCleanerPayCents')}
          hint="Default amount owed to the cleaner for each clean."
          required
        >
          <Input value={v.pay} onChange={set('pay')} inputMode="decimal" className="figure" />
        </Field>
      </Section>

      <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-col gap-3 border-t border-line-soft bg-surface/95 px-6 py-4 backdrop-blur-sm">
        {hasFieldErrors && <p className="text-sm text-danger-deep">Some fields need a look. They’re marked above.</p>}
        <ErrorAlert error={Object.keys(server).length ? null : error} />
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={pending}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
