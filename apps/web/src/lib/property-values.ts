export interface PropertyFormValues {
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  checkInTime: string;
  checkOutTime: string;
  provincialRegistrationNumber: string | null;
  businessLicenceNumber: string | null;
  accessInstructions: string | null;
  defaultCleanerPayCents: number;
}

export const emptyProperty: PropertyFormValues = {
  name: '',
  addressLine1: '',
  addressLine2: null,
  city: 'Vancouver',
  postalCode: '',
  checkInTime: '16:00',
  checkOutTime: '11:00',
  provincialRegistrationNumber: null,
  businessLicenceNumber: null,
  accessInstructions: null,
  defaultCleanerPayCents: 0,
};
