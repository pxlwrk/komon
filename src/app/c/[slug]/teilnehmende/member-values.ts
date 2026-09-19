/**
 * Typ und Vorbelegung des Teilnehmerformulars.
 *
 * Getrennt vom Formular, weil Server Components aus einem Modul mit
 * "use client" nur Komponenten beziehen dürfen.
 */

export type CustomFieldDefinitionView = {
  id: string;
  key: string;
  label: string;
  type: string;
  description: string | null;
  options: string[];
  required: boolean;
};

export type MemberFormValues = {
  salutation: string | null;
  title: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  pronouns: string | null;
  primaryEmail: string;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  birthDate: string | null;
  organization: string | null;
  jobTitle: string | null;
  website: string | null;
  notes: string | null;
  memberNumber: string | null;
  position: string | null;
  membershipStatus: string;
  personStatus: string;
  mailPreference: string;
  allowBulkEmail: boolean;
  customValues: Record<string, string | string[] | null>;
};

/** Leeres Formular für eine neu aufzunehmende Person. */
export function emptyMemberValues(): MemberFormValues {
  return {
    salutation: null,
    title: null,
    firstName: '',
    lastName: '',
    displayName: null,
    pronouns: null,
    primaryEmail: '',
    phone: null,
    mobile: null,
    street: null,
    postalCode: null,
    city: null,
    region: null,
    country: 'Deutschland',
    birthDate: null,
    organization: null,
    jobTitle: null,
    website: null,
    notes: null,
    memberNumber: null,
    position: null,
    membershipStatus: 'ACTIVE',
    personStatus: 'ACTIVE',
    mailPreference: 'REGULAR',
    allowBulkEmail: true,
    customValues: {},
  };
}

/** Liest die als JSON abgelegten Auswahlmöglichkeiten eines Zusatzfeldes. */
export function parseFieldOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
