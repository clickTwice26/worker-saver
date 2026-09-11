import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/engine/analyze.ts';
import type { EngineInput } from '../src/engine/analyze.ts';

/** A minimal, fully explicit engine input. One role, one machine, one programme. */
function baseInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    asOfDate: '2026-09-04',
    roles: [{ id: 1, slug: 'cutter', label: 'Cutters' }],
    headcounts: [{ roleId: 1, headcount: 260 }],
    machineryPlans: [{
      id: 10, machineName: 'Laser cutter', machineTypeId: 50, affectedRoleId: 1,
      arrivalDate: '2026-12-01', units: 2, headcountDisplacedPerUnit: null,
    }],
    riskRules: [{
      roleId: 1, machineTrigger: 'Automated cutting', baseScore: 74, band: 'high',
      rationale: 'Test rationale', sourceRef: 'Test source', confidence: 'estimated',
    }],
    trainingPrograms: [{
      id: 100, name: 'Cutter supervision', targetRoleId: 1,
      durationWeeks: 3, seatsPerMonth: 12, costPerSeatBdt: 8500, provider: 'In-house',
    }],
    machineTypes: [{
      id: 50, name: 'Test laser cutter', capitalCostBdt: 8_500_000, healthSafetyNote: null,
      impact: [{ roleId: 1, displacedPerUnit: 12, createdPerUnit: 2 }],
    }],
    wageBands: [{ roleId: 1, monthlyCostBdt: 23_000 }],
    ...overrides,
  };
}

test('produces one finding per matched machinery plan', () => {
  const { findings, gaps } = analyze(baseInput());

  assert.equal(findings.length, 1);
  assert.equal(gaps.length, 0);

  const finding = findings[0]!;
  assert.equal(finding.riskScore, 74);
  assert.equal(finding.riskBand, 'high');
  assert.equal(finding.monthsUntilImpact, 3, 'matches the specification worked example');
});

test('workers affected is capped at the role headcount', () => {
  // 40 units x 12 displaced = 480, against a roster of only 260.
  const input = baseInput();
  input.machineryPlans[0]!.units = 40;

  const finding = analyze(input).findings[0]!;
  assert.equal(finding.workersAffected, 260, 'cannot displace more people than are employed');
});

test('schedule works backwards from the arrival date', () => {
  const finding = analyze(baseInput()).findings[0]!;

  // 24 workers at 12 seats/month = 2 cohorts. Lead time is one extra intake
  // month (30 days) plus the 3-week programme = 51 days before 2026-12-01.
  assert.equal(finding.workersAffected, 24);
  assert.equal(finding.cohortsRequired, 2);
  assert.equal(finding.startByDate, '2026-10-11');
  assert.equal(finding.scheduleStatus, 'on_track');
  assert.equal(finding.estimatedCostBdt, 24 * 8500);
});

test('a passed start-by date is reported as overdue rather than hidden', () => {
  const input = baseInput();
  input.machineryPlans[0]!.arrivalDate = '2026-09-10';

  const finding = analyze(input).findings[0]!;
  assert.equal(finding.scheduleStatus, 'overdue');
  assert.ok(finding.daysUntilStartBy < 0);
});

test('a start-by date inside 30 days is flagged as starting soon', () => {
  const input = baseInput();
  // 51 days of lead time, so an arrival 60 days out starts in 9 days.
  input.machineryPlans[0]!.arrivalDate = '2026-11-03';

  assert.equal(analyze(input).findings[0]!.scheduleStatus, 'starts_soon');
});

/**
 * The ethics constraint, enforced in the engine as well as the schema:
 * a role with no training programme produces a coverage gap, never a bare score.
 */
test('a role with no training programme yields a gap, not a risk score', () => {
  const { findings, gaps } = analyze(baseInput({ trainingPrograms: [] }));

  assert.equal(findings.length, 0, 'must not emit a score with no recommended action');
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.reason, 'no_training_program');
});

test('a role with no risk rule yields a gap', () => {
  const { findings, gaps } = analyze(baseInput({ riskRules: [] }));
  assert.equal(findings.length, 0);
  assert.equal(gaps[0]!.reason, 'no_risk_rule');
});

test('a machine affecting a role nobody holds yields a gap', () => {
  const { findings, gaps } = analyze(baseInput({ headcounts: [] }));
  assert.equal(findings.length, 0);
  assert.equal(gaps[0]!.reason, 'no_headcount');
});

test('where a role has several rules the most exposed one governs', () => {
  const input = baseInput();
  input.riskRules.push({
    roleId: 1, machineTrigger: 'Something milder', baseScore: 20, band: 'low',
    rationale: 'Lower', sourceRef: 'Test', confidence: 'estimated',
  });

  assert.equal(analyze(input).findings[0]!.riskScore, 74);
});

test('weighted risk is the headcount-weighted mean of base scores', () => {
  const input = baseInput({
    roles: [
      { id: 1, slug: 'a', label: 'A' },
      { id: 2, slug: 'b', label: 'B' },
    ],
    headcounts: [{ roleId: 1, headcount: 100 }, { roleId: 2, headcount: 300 }],
    riskRules: [
      { roleId: 1, machineTrigger: 'x', baseScore: 80, band: 'high', rationale: 'r', sourceRef: 's', confidence: 'estimated' },
      { roleId: 2, machineTrigger: 'y', baseScore: 20, band: 'low', rationale: 'r', sourceRef: 's', confidence: 'estimated' },
    ],
  });

  // (80*100 + 20*300) / 400 = 35
  assert.equal(analyze(input).weightedRiskScore, 35);
});

test('the engine is deterministic and independent of input ordering', () => {
  const input = baseInput();
  input.machineryPlans.push({
    id: 11, machineName: 'Second cutter', machineTypeId: 50, affectedRoleId: 1,
    arrivalDate: '2027-03-01', units: 1, headcountDisplacedPerUnit: 6,
  });

  const forward = analyze(input);
  const reversed = analyze({ ...input, machineryPlans: [...input.machineryPlans].reverse() });

  assert.deepEqual(forward.findings, reversed.findings, 'row order must not change output');
});

/**
 * The catalogue is what turns a guess into a computation.
 *
 * Before it existed, `headcountDisplacedPerUnit` was typed in by the user —
 * the product asked the factory for the answer it was supposed to supply.
 */
test('displacement is derived from the catalogue when the plan does not override it', () => {
  const finding = analyze(baseInput()).findings[0]!;

  // 2 units x 12 displaced per unit, from the machine type, not from the plan.
  assert.equal(finding.workersAffected, 24);
  assert.equal(finding.derivedFromCatalogue, true);
  assert.equal(finding.machineTypeName, 'Test laser cutter');
});

test('an explicit figure on the plan overrides the catalogue', () => {
  const input = baseInput();
  input.machineryPlans[0]!.headcountDisplacedPerUnit = 3;

  const finding = analyze(input).findings[0]!;
  assert.equal(finding.workersAffected, 6, 'the factory’s own figure governs');
  assert.equal(finding.derivedFromCatalogue, false);
});

test('a machine creates posts as well as removing them', () => {
  const finding = analyze(baseInput()).findings[0]!;

  // 2 units x 2 operators created per unit.
  assert.equal(finding.workersCreated, 4);
  assert.equal(finding.netWorkforceChange, -20, 'net is created minus displaced');
});

test('payback is computed from the net wage bill, not the gross', () => {
  const finding = analyze(baseInput()).findings[0]!;

  // Net 20 posts removed at BDT 23,000 = 460,000/month against 2 x 8,500,000.
  assert.equal(finding.monthlyLabourSavingBdt, 20 * 23_000);
  assert.equal(finding.capitalCostBdt, 2 * 8_500_000);
  assert.equal(finding.paybackMonths, Math.ceil(17_000_000 / 460_000));
});

test('payback is null when a machine removes no net wage bill', () => {
  const input = baseInput();
  // Creates exactly as many posts as it displaces.
  input.machineTypes[0]!.impact[0]!.createdPerUnit = 12;

  const finding = analyze(input).findings[0]!;
  assert.equal(finding.netWorkforceChange, 0);
  assert.equal(finding.paybackMonths, null, 'no saving means no payback, not a divide by zero');
});

test('a machine with no catalogue entry and no override displaces nobody', () => {
  const input = baseInput({ machineTypes: [] });
  input.machineryPlans[0]!.headcountDisplacedPerUnit = null;

  const finding = analyze(input).findings[0]!;
  assert.equal(finding.workersAffected, 0, 'better to report zero than to invent a figure');
  assert.equal(finding.derivedFromCatalogue, false);
});

test('the health and safety note travels with the finding', () => {
  const input = baseInput();
  input.machineTypes[0]!.healthSafetyNote = 'Replaces hazardous manual work.';

  assert.equal(analyze(input).findings[0]!.healthSafetyNote, 'Replaces hazardous manual work.');
});
