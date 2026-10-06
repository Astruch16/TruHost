import { useState, type FormEvent } from 'react';
import { Button, ErrorBanner, Field, Input } from './ui';
import { fieldErrors } from '../lib/errors';
import type { PropertyFormValues } from '../lib/property-values';
import { centsToInput, parseDollarsToCents } from '../lib/money';

/** Shared by create and edit. Empty optional fields are sent as null. */
export function PropertyForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  initial: PropertyFormValues;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: PropertyFormValues) => void;
}) {
  const [v, setV] = useState({
    ...initial,
    addressLine2: initial.addressLine2 ?? '',
    provincialRegistrationNumber: initial.provincialRegistrationNumber ?? '',
    businessLicenceNumber: initial.businessLicenceNumber ?? '',
    accessInstructions: initial.accessInstructions ?? '',
    pay: centsToInput(initial.defaultCleanerPayCents),
  });
  const [payError, setPayError] = useState<string>();
  const errors = fieldErrors(error);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [key]: e.target.value });
  const orNull = (s: string) => (s.trim() ? s.trim() : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollarsToCents(v.pay);
    if (cents === null) return setPayError('Enter an amount like 90 or 90.50');
    setPayError(undefined);
    onSubmit({
      name: v.name,
      addressLine1: v.addressLine1,
      addressLine2: orNull(v.addressLine2),
      city: v.city,
      postalCode: v.postalCode,
      checkInTime: v.checkInTime,
      checkOutTime: v.checkOutTime,
      provincialRegistrationNumber: orNull(v.provincialRegistrationNumber),
      businessLicenceNumber: orNull(v.businessLicenceNumber),
      accessInstructions: orNull(v.accessInstructions),
      defaultCleanerPayCents: cents,
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Name" error={errors.name} hint="Internal nickname, e.g. “Kits 2BR”">
        <Input value={v.name} onChange={set('name')} required />
      </Field>
      <Field label="Postal code" error={errors.postalCode}>
        <Input value={v.postalCode} onChange={set('postalCode')} required />
      </Field>
      <Field label="Address" error={errors.addressLine1}>
        <Input value={v.addressLine1} onChange={set('addressLine1')} required />
      </Field>
      <Field label="Unit / line 2" error={errors.addressLine2}>
        <Input value={v.addressLine2} onChange={set('addressLine2')} />
      </Field>
      <Field label="City" error={errors.city}>
        <Input value={v.city} onChange={set('city')} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in" error={errors.checkInTime}>
          <Input type="time" value={v.checkInTime} onChange={set('checkInTime')} required />
        </Field>
        <Field label="Check-out" error={errors.checkOutTime}>
          <Input type="time" value={v.checkOutTime} onChange={set('checkOutTime')} required />
        </Field>
      </div>
      <Field label="BC STR registration #" error={errors.provincialRegistrationNumber}>
        <Input value={v.provincialRegistrationNumber} onChange={set('provincialRegistrationNumber')} />
      </Field>
      <Field label="Business licence #" error={errors.businessLicenceNumber}>
        <Input value={v.businessLicenceNumber} onChange={set('businessLicenceNumber')} />
      </Field>
      <Field label="Default cleaner pay per clean ($)" error={payError ?? errors.defaultCleanerPayCents}>
        <Input value={v.pay} onChange={set('pay')} inputMode="decimal" required />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Access instructions"
          error={errors.accessInstructions}
          hint="Visible to admins and this property’s cleaners only"
        >
          <textarea
            value={v.accessInstructions}
            onChange={set('accessInstructions')}
            rows={3}
            className="rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm"
          />
        </Field>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <ErrorBanner error={Object.keys(errors).length ? null : error} />
        <div>
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
