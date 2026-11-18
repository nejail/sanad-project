/** Qatar mobile numbers: 8 digits starting with 3, 5, 6 or 7 (country code +974 shown separately). */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '').replace(/^974/, '').slice(0, 8);
}

export function isValidQatarMobile(input: string): boolean {
  return /^[3567]\d{7}$/.test(normalizePhone(input));
}

export function formatPhone(phone: string): string {
  const p = normalizePhone(phone);
  return p.length > 4 ? `${p.slice(0, 4)} ${p.slice(4)}` : p;
}

export function isValidName(name: string): boolean {
  return name.trim().length >= 2;
}

/** Plates are shown as QA-1234 in the designs; accept 1 to 6 digits. */
export function normalizePlate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 6);
  return digits ? `QA-${digits}` : '';
}

export function isValidPlate(input: string): boolean {
  return /^QA-\d{1,6}$/.test(normalizePlate(input));
}

export function isValidYear(year: string, now = new Date()): boolean {
  const y = Number(year);
  return Number.isInteger(y) && y >= 1980 && y <= now.getFullYear() + 1;
}

/** Colour chips on Add Car; "Other" opens a text box for unusual colours. */
export const CAR_COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Gold', 'Other'];
export const OTHER_COLOR = 'Other';

/**
 * The colour to save for a car: the chosen chip, or the typed colour when "Other" is chosen.
 * Returns null when "Other" is chosen but nothing usable was typed.
 */
export function resolveCarColor(choice: string, typed: string): string | null {
  if (choice !== OTHER_COLOR) return choice;
  const t = typed.trim().replace(/\s+/g, ' ');
  if (t.length < 2 || t.length > 30) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
