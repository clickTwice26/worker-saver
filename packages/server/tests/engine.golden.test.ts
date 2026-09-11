import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE_AS_OF, makeTestDb, makeFixtureFactory } from './helpers.ts';
import { runAnalysis, getPlan, buildReport } from '../src/services/analysis-service.ts';

/**
 * The golden-file test.
 *
 * Runs the whole pipeline against the seeded demo factory at a fixed date and
 * compares the result to a committed snapshot. Any change to a risk score, a
 * training capacity or the scheduling arithmetic shows up here as a reviewable
 * diff rather than as a number that quietly moved.
 *
 * To accept an intended change:  UPDATE_GOLDEN=1 npm test -w @ale/server
 * Then read the diff before committing it.
 */

const goldenPath = join(dirname(fileURLToPath(import.meta.url)), 'golden', 'fixture-factory.json');

test('the fixture factory produces the committed golden output', () => {
  const db = makeTestDb();
  const { factoryId } = makeFixtureFactory(db);
  const { run, gaps } = runAnalysis(db, factoryId, FIXTURE_AS_OF);
  const plan = getPlan(db, run);
  assert.ok(plan, 'plan should be produced');

  // `run.id` and `runAt` are the only non-deterministic fields; both are dropped
  // so the snapshot captures the engine's output rather than the clock.
  const snapshot = {
    asOfDate: plan.run.asOfDate,
    engineVersion: plan.run.engineVersion,
    rulesVersion: plan.run.rulesVersion,
    totals: plan.totals,
    gaps,
    findings: plan.findings.map(({ id, runId, ...rest }) => rest),
    schedule: plan.schedule.map((month) => ({
      ...month,
      entries: month.entries.map(({ findingId, ...rest }) => rest),
    })),
  };

  const actual = `${JSON.stringify(snapshot, null, 2)}\n`;

  if (process.env['UPDATE_GOLDEN'] === '1' || !existsSync(goldenPath)) {
    writeFileSync(goldenPath, actual);
    console.log(`Golden file written to ${goldenPath}`);
    db.close();
    return;
  }

  assert.equal(actual, readFileSync(goldenPath, 'utf8'),
    'Engine output changed. Review the diff, then re-record with UPDATE_GOLDEN=1 if intended.');
  db.close();
});

test('the rules version changes when a risk score changes', () => {
  const db = makeTestDb();
  const { factoryId } = makeFixtureFactory(db);
  const before = runAnalysis(db, factoryId, FIXTURE_AS_OF).run.rulesVersion;

  db.prepare('UPDATE risk_rules SET base_score = base_score + 1 WHERE id = 1').run();
  const after = runAnalysis(db, factoryId, FIXTURE_AS_OF).run.rulesVersion;

  assert.notEqual(before, after, 'an edited knowledge base must be visible in the run history');
  db.close();
});

test('re-running the analysis appends a run rather than overwriting the last', () => {
  const db = makeTestDb();
  const { factoryId } = makeFixtureFactory(db);
  const first = runAnalysis(db, factoryId, FIXTURE_AS_OF).run;
  const second = runAnalysis(db, factoryId, FIXTURE_AS_OF).run;

  assert.notEqual(first.id, second.id);
  // A report already sent to a buyer must stay re-derivable.
  const original = getPlan(db, first);
  assert.ok(original);
  assert.equal(original.findings.length, first.findingCount);
  db.close();
});

/**
 * The report's completion dates must not outrun the machine.
 *
 * An earlier version computed lead time a second time inside the report and got
 * a different answer, producing commitments that claimed training finished after
 * the arrival it was meant to precede. Both now share `leadTimeDays()`.
 */
test('every commitment completes on or before the machine it prepares for', () => {
  const db = makeTestDb();
  const { factoryId } = makeFixtureFactory(db);
  const { run } = runAnalysis(db, factoryId, FIXTURE_AS_OF);
  const plan = getPlan(db, run);
  assert.ok(plan);

  const report = buildReport(plan);
  assert.ok(report.commitments.length > 0, 'the demo factory should produce commitments');

  for (const commitment of report.commitments) {
    const finding = plan.findings.find(
      (f) => f.roleLabel === commitment.roleLabel && f.startByDate === commitment.startByDate,
    );
    assert.ok(finding, `no finding behind commitment for ${commitment.roleLabel}`);
    assert.ok(
      commitment.completesByDate <= finding.arrivalDate,
      `${commitment.roleLabel}: training completes ${commitment.completesByDate}, ` +
      `but ${finding.machineName} arrives ${finding.arrivalDate}`,
    );
  }
  db.close();
});
