/**
 * Nepal phone number helpers.
 *
 * The form stores the *local* part ("9801234567") so the input stays easy to
 * type, while verification and every displayed reference use the full
 * international form ("+977 9801234567"). Keeping one canonical form means
 * the verification key can never drift from what the user sees.
 */

export const NEPAL_DIAL_CODE = '+977';

/** Strips a leading +977 / 977 prefix and keeps only the digits. */
export function normalizeNepalPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('977')) return digits;
  return `977${digits}`;
}

/** Canonical stored value: `977` followed by the 10-digit local number. */
export function canonicalPhoneKey(value: string): string {
  return normalizeNepalPhone(value);
}

/** Display form with the country code, e.g. `+977 9801234567`. */
export function formatNepalPhone(value: string): string {
  const normalized = normalizeNepalPhone(value);
  const local = normalized.startsWith('977') ? normalized.slice(3) : normalized;
  return `${NEPAL_DIAL_CODE} ${local}`.trim();
}
