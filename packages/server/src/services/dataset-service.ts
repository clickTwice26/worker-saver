/**
 * Server-side datasets.
 *
 * Generated CSVs are read from disk by the server rather than uploaded through
 * the browser. A million-row outcomes file is around 140MB: posting it as a
 * JSON string would exceed any sane body limit, double in memory as a UTF-16
 * string, and make the browser hold the whole thing at once. Reading it where
 * it already lives avoids all three.
 */

import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, join, resolve, sep } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { config } from '../config.ts';
import { HttpError } from '../lib/http.ts';
import {
  importMachinery, importOutcomes, importRoster, importWorkers,
  type ImportKind, type ImportResult,
} from './import-service.ts';

/** The order matters: outcomes reference roles the roster establishes. */
const FILES: Array<{ kind: ImportKind; file: string }> = [
  { kind: 'roster', file: 'roster.csv' },
  { kind: 'workers', file: 'workers.csv' },
  { kind: 'machinery', file: 'machinery.csv' },
  { kind: 'outcomes', file: 'outcomes.csv' },
];

const IMPORTERS = {
  roster: importRoster,
  machinery: importMachinery,
  workers: importWorkers,
  outcomes: importOutcomes,
} as const;

export interface DatasetFile {
  kind: ImportKind;
  file: string;
  bytes: number;
  /** Data rows, excluding the header. */
  rows: number;
}

export interface Dataset {
  name: string;
  files: DatasetFile[];
  totalBytes: number;
  totalRows: number;
}

/** Count data rows by streaming, so a 140MB file is never held in memory. */
async function countRows(path: string): Promise<number> {
  const reader = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let lines = 0;
  for await (const line of reader) if (line.length > 0) lines += 1;
  return Math.max(0, lines - 1);
}

/**
 * Resolve a dataset name to a directory inside the configured root.
 *
 * The name comes from a URL, so it is checked against the resolved root rather
 * than trusted: `../../etc` must not escape into the filesystem.
 */
function resolveDatasetDir(name: string): string {
  const root = resolve(config.datasetsDir);
  const target = resolve(root, name);
  if (target !== root && !target.startsWith(root + sep)) {
    throw HttpError.badRequest(`Invalid dataset name "${name}".`);
  }
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    throw HttpError.notFound(`No dataset named "${name}".`);
  }
  return target;
}

export async function listDatasets(): Promise<Dataset[]> {
  const root = resolve(config.datasetsDir);
  if (!existsSync(root)) return [];

  const entries = readdirSync(root, { withFileTypes: true });
  // A directory of CSVs is a dataset; a bare directory of CSVs at the root is
  // also treated as one, which is what `--out ./generated` produces.
  const candidates = entries.some((e) => e.isFile() && e.name.endsWith('.csv'))
    ? [root]
    : entries.filter((e) => e.isDirectory()).map((e) => join(root, e.name));

  const datasets: Dataset[] = [];
  for (const dir of candidates) {
    const files: DatasetFile[] = [];
    for (const { kind, file } of FILES) {
      const path = join(dir, file);
      if (!existsSync(path)) continue;
      files.push({ kind, file, bytes: statSync(path).size, rows: await countRows(path) });
    }
    if (files.length === 0) continue;

    datasets.push({
      name: dir === root ? basename(root) : basename(dir),
      files,
      totalBytes: files.reduce((s, f) => s + f.bytes, 0),
      totalRows: files.reduce((s, f) => s + f.rows, 0),
    });
  }
  return datasets;
}

export interface DatasetImportResult {
  dataset: string;
  results: ImportResult[];
  totalAccepted: number;
  totalRejected: number;
  seconds: number;
}

/** Import every file in a dataset, in dependency order. */
export function importDataset(
  db: DatabaseSync, factoryId: number, name: string,
): DatasetImportResult {
  const dir = resolveDatasetDir(name);
  const started = Date.now();
  const results: ImportResult[] = [];

  for (const { kind, file } of FILES) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    // Read whole rather than streamed: the parser handles newlines inside
    // quoted fields, which a line-at-a-time reader cannot do correctly, and the
    // server has the file locally either way.
    results.push(IMPORTERS[kind](db, factoryId, readFileSync(path, 'utf8'), file));
  }

  if (results.length === 0) {
    throw HttpError.badRequest(`Dataset "${name}" contains no importable CSV files.`);
  }

  return {
    dataset: name,
    results,
    totalAccepted: results.reduce((s, r) => s + r.rowsAccepted, 0),
    totalRejected: results.reduce((s, r) => s + r.rowsRejected, 0),
    seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
  };
}
