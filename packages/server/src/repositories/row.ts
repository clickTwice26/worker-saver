/**
 * Coercion helpers for `node:sqlite` rows.
 *
 * Rows arrive as null-prototype objects of loosely typed values. Converting
 * through these helpers keeps the casts in one place and fails loudly on a
 * column rename rather than producing `undefined` three layers up.
 */

export type Row = Record<string, unknown>;

export function num(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  throw new Error(`Expected numeric column "${key}", received ${typeof value}`);
}

export function str(row: Row, key: string): string {
  const value = row[key];
  if (typeof value === 'string') return value;
  throw new Error(`Expected text column "${key}", received ${typeof value}`);
}

export function bool(row: Row, key: string): boolean {
  return num(row, key) === 1;
}

/** Narrow a text column to a union, failing on anything unexpected. */
export function enumOf<T extends string>(row: Row, key: string, allowed: readonly T[]): T {
  const value = str(row, key);
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Column "${key}" held unexpected value "${value}"`);
}
