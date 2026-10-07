import { useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { ErrorAlert } from './ui/alert';
import { Field } from './ui/field';
import { Input } from './ui/input';
import { fieldErrors } from '../lib/errors';
import { centsToInput, parseDollarsToCents } from '../lib/money';
import type { PropertyFormValues } from '../lib/property-values';

/** Shared by create and edit. Empty optional fields are sent as null. */
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
  const [v, setV] = useState({
    ...initial,
    addressLine2: initial.addressLine2 ?? '',
    provincialRegistrationNumber: initial.provincialRegistrationNumber ?? '',
    businessLicenceNumber: initial.businessLicenceNumber ?? '',
    pay: centsToInput(initial.defaultCleanerPayCents),
    cleaningFee: centsToInput(initial.standardCleaningFeeCents),
  });
  const [moneyErrors, setMoneyErrors] = useState<{ pay?: string; cleaningFee?: string }>({});
  const errors = fieldErrors(error);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [key]: e.target.value });
  const orNull = (s: string) => (s.trim() ? s.trim() : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollarsToCents(v.pay);
    const feeCents = parseDollarsToCents(v.cleaningFee);
    const bad = 'Enter an amount like 90 or 90.50';
    setMoneyErrors({ pay: cents === null ? bad : undefined, cleaningFee: feeCents === null ? bad : undefined });
    if (cents === null || feeCents === null) return;
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
      defaultCleanerPayCents: cents,
      standardCleaningFeeCents: feeCents,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid max-w-4xl gap-4 @xl/content:grid-cols-2">
      <Field label="Name" error={errors.name} hint="Internal nickname, e.g. “Cedar Suite”" required>
        <Input value={v.name} onChange={set('name')} autoComplete="off" />
      </Field>
      <Field label="Postal code" error={errors.postalCode} required>
        <Input value={v.postalCode} onChange={set('postalCode')} autoComplete="postal-code" />
      </Field>
      <Field label="Street address" error={errors.addressLine1} required>
        <Input value={v.addressLine1} onChange={set('addressLine1')} autoComplete="address-line1" />
      </Field>
      <Field label="Unit / line 2" error={errors.addressLine2}>
        <Input value={v.addressLine2} onChange={set('addressLine2')} autoComplete="address-line2" />
      </Field>
      <Field label="City" error={errors.city} required>
        <Input value={v.city} onChange={set('city')} autoComplete="address-level2" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Check-in" error={errors.checkInTime} required>
          <Input type="time" value={v.checkInTime} onChange={set('checkInTime')} />
        </Field>
        <Field label="Check-out" error={errors.checkOutTime} required>
          <Input type="time" value={v.checkOutTime} onChange={set('checkOutTime')} />
        </Field>
      </div>
      <Field label="BC STR registration #" error={errors.provincialRegistrationNumber}>
        <Input value={v.provincialRegistrationNumber} onChange={set('provincialRegistrationNumber')} />
      </Field>
      <Field label="Business licence #" error={errors.businessLicenceNumber}>
        <Input value={v.businessLicenceNumber} onChange={set('businessLicenceNumber')} />
      </Field>
      <Field
        label="Standard cleaning fee ($)"
        error={moneyErrors.cleaningFee ?? errors.standardCleaningFeeCents}
        hint="What guests are normally charged. Owners pay this after an owner stay."
        required
      >
        <Input value={v.cleaningFee} onChange={set('cleaningFee')} inputMode="decimal" className="figure" />
      </Field>
      <Field
        label="Cleaner pay per clean ($)"
        error={moneyErrors.pay ?? errors.defaultCleanerPayCents}
        hint="Default amount owed to the cleaner for each clean."
        required
      >
        <Input value={v.pay} onChange={set('pay')} inputMode="decimal" className="figure" />
      </Field>
      <div className="flex flex-col gap-3 @xl/content:col-span-2">
        <ErrorAlert error={Object.keys(errors).length ? null : error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
