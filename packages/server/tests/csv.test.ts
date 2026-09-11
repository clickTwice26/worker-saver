import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, field, parseInteger, normaliseHeader } from '../src/lib/csv.ts';

test('parses a plain file', () => {
  const { headers, rows } = parseCsv('role,workers\nSewing,1420\nCutting,260\n');
  assert.deepEqual(headers, ['role', 'workers']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!['workers'], '1420');
});

/** The reason this parser exists rather than a split(','). */
test('a quoted comma stays inside its field', () => {
  const { rows } = parseCsv('role,workers\n"Finishing, Ironing & Pressing",540\n');
  assert.equal(rows[0]!['role'], 'Finishing, Ironing & Pressing');
  assert.equal(rows[0]!['workers'], '540');
});

test('escaped quotes and embedded newlines survive', () => {
  const { rows } = parseCsv('name,note\n"He said ""go""","line one\nline two"\n');
  assert.equal(rows[0]!['name'], 'He said "go"');
  assert.equal(rows[0]!['note'], 'line one\nline two');
});

test('a byte order mark does not corrupt the first header', () => {
  const { headers } = parseCsv('﻿role,workers\nSewing,10\n');
  assert.deepEqual(headers, ['role', 'workers'], 'Excel writes a BOM');
});

test('headers are matched regardless of case and separator', () => {
  assert.equal(normaliseHeader('  Worker Ref '), 'worker_ref');
  assert.equal(normaliseHeader('worker-ref'), 'worker_ref');

  const { rows } = parseCsv('Worker Ref,Tenure Months\nA-1,36\n');
  assert.equal(field(rows[0]!, 'worker_ref'), 'A-1');
  assert.equal(field(rows[0]!, 'tenureMonths', 'tenure_months'), '36');
});

test('blank lines and short rows do not throw', () => {
  const { rows } = parseCsv('a,b,c\n1,2\n\n3,4,5\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!['c'], '', 'a missing trailing field reads as empty');
});

test('integers tolerate thousands separators and reject decimals', () => {
  assert.equal(parseInteger('1,420'), 1420);
  assert.equal(parseInteger('260'), 260);
  assert.equal(parseInteger('12.5'), null);
  assert.equal(parseInteger('abc'), null);
  assert.equal(parseInteger(undefined), null);
});

test('an empty file parses to nothing rather than failing', () => {
  assert.deepEqual(parseCsv(''), { headers: [], rows: [] });
  assert.deepEqual(parseCsv('\n\n'), { headers: [], rows: [] });
});
