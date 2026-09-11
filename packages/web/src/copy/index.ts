import { copy, type CopyKey } from './strings.ts';

export { copy };
export type { CopyKey };

/** Look up interface copy by key. */
export function t(key: CopyKey): string {
  return copy[key];
}

const LOCALE = 'en-GB';

const numberFormat = new Intl.NumberFormat(LOCALE);
const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const monthFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});
const currencyFormat = new Intl.NumberFormat(LOCALE, {
  style: 'currency', currency: 'BDT', maximumFractionDigits: 0,
});

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** `YYYY-MM-DD` to a readable date. Parsed as UTC so the day never shifts. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

/** `YYYY-MM` to a readable month. */
export function formatMonth(yyyymm: string): string {
  return monthFormat.format(new Date(`${yyyymm}-01T00:00:00Z`));
}

/** Costs are quoted in Bangladeshi taka throughout. */
export function formatCurrency(bdt: number): string {
  return currencyFormat.format(bdt);
}
