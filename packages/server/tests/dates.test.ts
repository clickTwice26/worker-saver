import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, addMonths, addWeeks, approximateMonths,
  daysBetween, isValidIsoDate, monthKey, monthsBetween,
} from '../src/lib/dates.ts';

test('addMonths clamps to the last valid day of the target month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29', 'leap year');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15', 'crosses the year boundary');
  assert.equal(addMonths('2026-03-15', -1), '2026-02-15', 'negative offsets work');
});

test('approximateMonths matches the worked example in the specification', () => {
  // 2026-09-04 to 2026-12-01 reads as "3 months" in a planning conversation,
  // where strict completed-month arithmetic would say 2.
  assert.equal(approximateMonths('2026-09-04', '2026-12-01'), 3);
  assert.equal(monthsBetween('2026-09-04', '2026-12-01'), 2);
});

test('daysBetween is signed and symmetric', () => {
  assert.equal(daysBetween('2026-09-04', '2026-09-14'), 10);
  assert.equal(daysBetween('2026-09-14', '2026-09-04'), -10);
});

test('addDays and addWeeks cross month boundaries', () => {
  assert.equal(addDays('2026-09-04', -7), '2026-08-28');
  assert.equal(addWeeks('2026-12-01', -3), '2026-11-10');
});

test('isValidIsoDate rejects malformed and impossible dates', () => {
  assert.equal(isValidIsoDate('2026-09-04'), true);
  assert.equal(isValidIsoDate('2026-02-30'), false, 'February has no 30th');
  assert.equal(isValidIsoDate('2026-9-4'), false, 'requires zero padding');
  assert.equal(isValidIsoDate('not a date'), false);
  assert.equal(isValidIsoDate(20260904), false);
});

test('monthKey buckets to YYYY-MM', () => {
  assert.equal(monthKey('2026-12-31'), '2026-12');
});
