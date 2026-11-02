import { parseISO, isValid, format, getISODay } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export interface IPeriodGridItem {
  index: number;
  start: string; // 'HH:mm' e.g. '09:00'
  end: string;   // 'HH:mm' e.g. '10:00'
  blocked?: boolean;
  label?: string;
}

/**
 * Validates that the input is a valid calendar date in YYYY-MM-DD format.
 * Rejects nonexistent dates like 2026-02-31 or 2026-04-31.
 */
export function isValidDateKey(dateKey: string): boolean {
  if (typeof dateKey !== 'string' || !DATE_KEY_REGEX.test(dateKey)) {
    return false;
  }
  const parsed = parseISO(dateKey);
  if (!isValid(parsed)) {
    return false;
  }
  // Round-trip check to ensure no overflow or timezone shift occurred
  return format(parsed, 'yyyy-MM-dd') === dateKey;
}

/**
 * Returns today's dateKey (YYYY-MM-DD) in the specified timezone.
 */
export function today(timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
}

/**
 * Formats a Date object into a dateKey in the specified timezone.
 */
export function formatDateKey(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/**
 * Returns the ISO day of week for a dateKey (1 = Monday, 7 = Sunday).
 */
export function getISODayOfWeek(dateKey: string): number {
  if (!isValidDateKey(dateKey)) {
    throw new Error(`Invalid dateKey: ${dateKey}`);
  }
  return getISODay(parseISO(dateKey));
}

/**
 * Converts a dateKey and period from a grid into start and end UTC Date instants.
 */
export function periodToInstant(
  dateKey: string,
  periodIndex: number,
  grid: IPeriodGridItem[],
  timezone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } {
  if (!isValidDateKey(dateKey)) {
    throw new Error(`Invalid dateKey: ${dateKey}`);
  }

  const period = grid.find((p) => p.index === periodIndex);
  if (!period) {
    throw new Error(`Period index ${periodIndex} not found in grid`);
  }

  const startStr = `${dateKey} ${period.start}:00`;
  const endStr = `${dateKey} ${period.end}:00`;

  const start = fromZonedTime(startStr, timezone);
  const end = fromZonedTime(endStr, timezone);

  return { start, end };
}
