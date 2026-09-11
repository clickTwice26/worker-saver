import dayjs, { type Dayjs } from 'dayjs';

/**
 * Conversion between the picker and the wire format.
 *
 * The API speaks `YYYY-MM-DD` calendar dates with no time and no zone. A Dayjs
 * object is a local instant, so the two must be converted deliberately:
 * `toISOString()` would render a date picked as 1 March in Dhaka as 28 February
 * in UTC, silently moving an arrival by a day. `format('YYYY-MM-DD')` renders
 * the local calendar date, which is the one the user actually chose.
 */

export type IsoDate = string;

export function isoToPicker(value: IsoDate | ''): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, 'YYYY-MM-DD');
  return parsed.isValid() ? parsed : null;
}

export function pickerToIso(value: Dayjs | null): IsoDate {
  return value && value.isValid() ? value.format('YYYY-MM-DD') : '';
}

/** The display format used across the product. */
export const DATE_FORMAT = 'DD/MM/YYYY';
