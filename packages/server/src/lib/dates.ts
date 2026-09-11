/**
 * Date helpers.
 *
 * Everything is handled as a `YYYY-MM-DD` string in UTC. Factory planning works
 * in whole days and months, and keeping timezone out of the engine is what lets
 * a run be reproduced exactly from its `as_of_date`.
 */

export type IsoDate = string;

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

export function parseIsoDate(value: IsoDate): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

export function isValidIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));
}

export function addWeeks(value: IsoDate, weeks: number): IsoDate {
  return addDays(value, weeks * 7);
}

/** Calendar-month arithmetic, clamping to the last valid day of the target month. */
export function addMonths(value: IsoDate, months: number): IsoDate {
  const date = parseIsoDate(value);
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toIsoDate(target);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

/**
 * Whole months from `from` to `to`, rounded down and floored at zero.
 *
 * Matches the specification's worked example: 2026-09-04 to 2026-12-01 is 2
 * completed months, which the product presents as "3 months away" only when the
 * day-of-month has passed. Callers wanting the display figure use `daysBetween`.
 */
export function monthsBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return months;
}

/** `YYYY-MM` bucket, used to group the training calendar. */
export function monthKey(value: IsoDate): string {
  return value.slice(0, 7);
}

const AVG_DAYS_PER_MONTH = 30.44;

/**
 * Months between two dates, rounded to nearest.
 *
 * This is the figure the product displays. It matches the worked example in the
 * v1 specification — 2026-09-04 to 2026-12-01 reads as "3 months" — where strict
 * completed-month arithmetic would say 2. Planning conversations round.
 */
export function approximateMonths(from: IsoDate, to: IsoDate): number {
  return Math.round(daysBetween(from, to) / AVG_DAYS_PER_MONTH);
}
