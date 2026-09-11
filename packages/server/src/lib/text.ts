/**
 * Normalise a role name for synonym lookup.
 *
 * Lowercases, collapses whitespace, and strips punctuation that varies between
 * how the concept documents and a factory's own spreadsheet write the same
 * role — "Finishing & Ironing Staff" and "finishing and ironing staff" have to
 * reach the same row.
 */
export function normaliseRoleName(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,/()[\]'"`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
