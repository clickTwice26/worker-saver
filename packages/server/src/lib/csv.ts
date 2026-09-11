/**
 * CSV parsing.
 *
 * Written out rather than pulled in because the requirement is narrow and the
 * failure mode of getting it wrong is silent: a naive `split(',')` corrupts
 * every row containing a quoted comma, which in this product means every role
 * label like "Finishing, Ironing & Pressing". Quoted fields, escaped quotes and
 * newlines inside quotes are all handled here.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface RowError {
  /** 1-based, counting the header, so it matches what a spreadsheet shows. */
  line: number;
  message: string;
}

/** Split CSV text into fields, honouring RFC 4180 quoting. */
function splitRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  // Strip a BOM: Excel writes one, and it otherwise becomes part of the first
  // header name, which then never matches anything.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { record.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

/** Header names are matched case- and separator-insensitively. */
export function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '_');
}

export function parseCsv(text: string): ParsedCsv {
  const records = splitRecords(text).filter((r) => r.some((f) => f.trim() !== ''));
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0]!.map(normaliseHeader);
  const rows = records.slice(1).map((record) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => { row[header] = (record[i] ?? '').trim(); });
    return row;
  });

  return { headers, rows };
}

/** Read a column by any of its accepted names. */
export function field(row: Record<string, string>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = row[normaliseHeader(name)];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

export function parseInteger(value: string | undefined): number | null {
  if (value === undefined) return null;
  // Tolerate thousands separators; a roster exported from a spreadsheet has them.
  const cleaned = value.replace(/[,\s]/g, '');
  const n = Number(cleaned);
  return Number.isInteger(n) ? n : null;
}
