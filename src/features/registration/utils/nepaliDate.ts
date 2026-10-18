/**
 * Bikram Sambat (Nepali) ↔ Gregorian date conversion for the registration flow.
 *
 * A thin, typed wrapper around `@inicrea/bikram-sambat-core` so the screens
 * never talk to the library directly. Everything is validated here:
 *
 *  - `YYYY-MM-DD` shape
 *  - the library's real supported range (BS 1975-01-01 → BS 2100-12-30,
 *    i.e. AD 1918-04-13 → AD 2044-04-12)
 *  - a "no future dates of birth" rule
 *
 * Conversion is day-exact: the library walks a generated month-length table
 * rather than applying a fixed year offset, so month and year boundaries and
 * 29–32 day months are handled correctly.
 */

import {
  BS_MONTHS_EN,
  BikramRangeError,
  EPOCH_AD_ISO,
  MAX_AD_ISO,
  adToBs,
  bsToAdIso,
  formatBs,
  getBsMonthCalendar,
  getWeekdayLabels,
  isValidBsDate,
  type BsDate,
  type BsMonthCalendar,
} from '@inicrea/bikram-sambat-core';

export const AD_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Earliest AD date the library can convert, `1918-04-13`. */
export const MIN_AD_DATE = EPOCH_AD_ISO;
/** Latest AD date the library can convert, `2044-04-12`. */
export const MAX_AD_DATE = MAX_AD_ISO;

export type AdDateParts = { year: number; month: number; day: number };

/**
 * Why a conversion failed. `FUTURE_DATE` covers the app-level "date of birth
 * cannot be in the future" rule; the rest mirror the library's own codes.
 */
export type DateConversionCode = 'INVALID_DATE' | 'OUT_OF_RANGE' | 'FUTURE_DATE';

export type DateConversionOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; code: DateConversionCode; message: string };

const failure = <T>(code: DateConversionCode, message: string): DateConversionOutcome<T> => ({
  ok: false,
  code,
  message,
});

/** Parses `YYYY-MM-DD` into numeric parts. Returns `null` for a bad shape. */
export function parseAdIso(value: string): AdDateParts | null {
  const trimmed = value.trim();
  if (!AD_ISO_PATTERN.test(trimmed)) return null;

  const [year, month, day] = trimmed.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Reject impossible calendar days such as 2023-02-30.
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/** Formats numeric AD parts as `YYYY-MM-DD`. */
export function toAdIso({ year, month, day }: AdDateParts): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Reads a `Date` in the user's local timezone and formats its calendar date.
 * Local (not UTC) components keep users in Nepal on the right day.
 */
export function dateToAdIso(date: Date): string {
  return toAdIso({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

/** Builds a local-midnight `Date` from an ISO calendar date. */
export function adIsoToDate(value: string): Date {
  const parts = parseAdIso(value);
  if (!parts) return new Date();
  return new Date(parts.year, parts.month - 1, parts.day);
}

/** Today as `YYYY-MM-DD`, read from the local clock. */
export function todayAdIso(): string {
  return dateToAdIso(new Date());
}

/**
 * Today's date expressed in Bikram Sambat.
 *
 * Obtains it by *converting* today's Gregorian date — never by reparsing the
 * AD string as a BS one, which silently yields a plausible-looking but wrong
 * BS date.
 */
export function todayBs(): BsDate {
  const outcome = convertAdToBs(todayAdIso());
  return outcome.ok ? outcome.value : { year: 2083, month: 1, day: 1 };
}

/** Negative when `a` is earlier than `b`, positive when later, 0 when equal. */
export function compareAdIso(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isFutureAdIso(value: string, today = todayAdIso()): boolean {
  return compareAdIso(value, today) > 0;
}

export function isValidAdIso(value: string): boolean {
  return parseAdIso(value) !== null;
}

export type ConvertOptions = {
  /**
   * When `true`, a date later than today is rejected with `FUTURE_DATE`.
   * Used for dates of birth, which must not be in the future.
   */
  rejectFuture?: boolean;
};

const OUT_OF_RANGE_MESSAGE = `Supported dates run from ${MIN_AD_DATE} to ${MAX_AD_DATE}.`;
const INVALID_DATE_MESSAGE = 'That date does not exist. Please pick a valid date.';
const FUTURE_DATE_MESSAGE = 'Date of birth cannot be in the future.';

/** Converts an AD `YYYY-MM-DD` date to its exact Bikram Sambat equivalent. */
export function convertAdToBs(
  adIso: string,
  options: ConvertOptions = {},
): DateConversionOutcome<BsDate> {
  const parts = parseAdIso(adIso);
  if (!parts) return failure('INVALID_DATE', INVALID_DATE_MESSAGE);

  if (options.rejectFuture && isFutureAdIso(adIso)) {
    return failure('FUTURE_DATE', FUTURE_DATE_MESSAGE);
  }

  try {
    const bs = adToBs(toAdIso(parts));
    return { ok: true, value: bs };
  } catch (error) {
    if (error instanceof BikramRangeError) {
      return failure(
        error.code === 'INVALID_DATE' ? 'INVALID_DATE' : 'OUT_OF_RANGE',
        error.code === 'INVALID_DATE' ? INVALID_DATE_MESSAGE : OUT_OF_RANGE_MESSAGE,
      );
    }
    return failure('INVALID_DATE', INVALID_DATE_MESSAGE);
  }
}

/** Converts a Bikram Sambat date to its exact AD `YYYY-MM-DD` equivalent. */
export function convertBsToAd(
  bs: BsDate,
  options: ConvertOptions = {},
): DateConversionOutcome<string> {
  if (!isValidBsDate(bs)) return failure('INVALID_DATE', INVALID_DATE_MESSAGE);

  try {
    const adIso = bsToAdIso(bs);

    if (options.rejectFuture && isFutureAdIso(adIso)) {
      return failure('FUTURE_DATE', FUTURE_DATE_MESSAGE);
    }

    return { ok: true, value: adIso };
  } catch (error) {
    if (error instanceof BikramRangeError) {
      return failure(
        error.code === 'INVALID_DATE' ? 'INVALID_DATE' : 'OUT_OF_RANGE',
        error.code === 'INVALID_DATE' ? INVALID_DATE_MESSAGE : OUT_OF_RANGE_MESSAGE,
      );
    }
    return failure('INVALID_DATE', INVALID_DATE_MESSAGE);
  }
}

/** Parses a BS `YYYY-MM-DD` string. Returns `null` when the shape is wrong. */
export function parseBsIso(value: string): BsDate | null {
  const trimmed = value.trim();
  if (!AD_ISO_PATTERN.test(trimmed)) return null;
  const [year, month, day] = trimmed.split('-').map(Number);
  if (!isValidBsDate({ year, month, day })) return null;
  return { year, month, day };
}

/** Formats a BS date as `YYYY-MM-DD`. */
export function formatBsIso(bs: BsDate): string {
  return formatBs(bs, 'YYYY-MM-DD');
}

/** Renderable 7-column grid for one BS month, for the BS picker. */
export function buildBsMonthCalendar(year: number, month: number): BsMonthCalendar {
  return getBsMonthCalendar(year, month);
}

/** Short Sunday-first weekday labels for the BS picker header. */
export function bsWeekdayLabels(): string[] {
  return [...getWeekdayLabels('en', 0, 'short')];
}

export type { BsDate, BsMonthCalendar };
/** Baishakh … Chaitra, indexed 0-11. */
export { BS_MONTHS_EN, BikramRangeError };