import type { DatabaseSync } from 'node:sqlite';
import type { AnalysisRun, Confidence, Finding, RiskBand, ScheduleStatus } from '@ale/shared';
import type { ComputedFinding } from '../engine/analyze.ts';
import { enumOf, num, str, type Row } from './row.ts';

const BANDS = ['high', 'moderate', 'low'] as const satisfies readonly RiskBand[];
const CONFIDENCES = ['sourced', 'estimated'] as const satisfies readonly Confidence[];
const STATUSES = ['on_track', 'starts_soon', 'overdue'] as const satisfies readonly ScheduleStatus[];

export function insertRun(
  db: DatabaseSync,
  input: { factoryId: number; runAt: string; asOfDate: string; rulesVersion: string; engineVersion: string },
): number {
  const result = db.prepare(`
    INSERT INTO analysis_runs (factory_id, run_at, as_of_date, rules_version, engine_version, finding_count)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(input.factoryId, input.runAt, input.asOfDate, input.rulesVersion, input.engineVersion);
  return Number(result.lastInsertRowid);
}

export function insertFindings(db: DatabaseSync, runId: number, findings: ComputedFinding[]): void {
  const statement = db.prepare(`
    INSERT INTO findings (
      run_id, role_id, machinery_plan_id, training_program_id, headcount,
      risk_score, risk_band, rationale, source_ref, confidence,
      months_until_impact, workers_affected, cohorts_required,
      start_by_date, schedule_status, days_until_start_by, estimated_cost_bdt,
      workers_created, net_workforce_change, derived_from_catalogue, machine_type_name,
      health_safety_note, monthly_labour_saving_bdt, capital_cost_bdt, payback_months,
      retraining_cost_ratio, score_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const f of findings) {
    statement.run(
      runId, f.roleId, f.machineryPlanId, f.trainingProgramId, f.headcount,
      f.riskScore, f.riskBand, f.rationale, f.sourceRef, f.confidence,
      f.monthsUntilImpact, f.workersAffected, f.cohortsRequired,
      f.startByDate, f.scheduleStatus, f.daysUntilStartBy, f.estimatedCostBdt,
      f.workersCreated, f.netWorkforceChange, f.derivedFromCatalogue ? 1 : 0, f.machineTypeName,
      f.healthSafetyNote, f.monthlyLabourSavingBdt, f.capitalCostBdt, f.paybackMonths,
      f.retrainingCostRatio, f.scoreSource,
    );
  }

  db.prepare('UPDATE analysis_runs SET finding_count = ? WHERE id = ?').run(findings.length, runId);
}

export function getRun(db: DatabaseSync, runId: number): AnalysisRun | null {
  const row = db.prepare(`
    SELECT id, factory_id, run_at, as_of_date, rules_version, engine_version, finding_count
    FROM analysis_runs WHERE id = ?
  `).get(runId) as Row | undefined;
  return row ? toRun(row) : null;
}

/** Most recent run for a factory, or null if the analysis has never been run. */
export function getLatestRun(db: DatabaseSync, factoryId: number): AnalysisRun | null {
  const row = db.prepare(`
    SELECT id, factory_id, run_at, as_of_date, rules_version, engine_version, finding_count
    FROM analysis_runs WHERE factory_id = ? ORDER BY id DESC LIMIT 1
  `).get(factoryId) as Row | undefined;
  return row ? toRun(row) : null;
}

export function listRuns(db: DatabaseSync, factoryId: number, limit = 20): AnalysisRun[] {
  const rows = db.prepare(`
    SELECT id, factory_id, run_at, as_of_date, rules_version, engine_version, finding_count
    FROM analysis_runs WHERE factory_id = ? ORDER BY id DESC LIMIT ?
  `).all(factoryId, limit) as Row[];
  return rows.map(toRun);
}

function toRun(row: Row): AnalysisRun {
  return {
    id: num(row, 'id'),
    factoryId: num(row, 'factory_id'),
    runAt: str(row, 'run_at'),
    asOfDate: str(row, 'as_of_date'),
    rulesVersion: str(row, 'rules_version'),
    engineVersion: str(row, 'engine_version'),
    findingCount: num(row, 'finding_count'),
  };
}

/**
 * Findings for a run, joined to everything the interface needs to render them.
 *
 * The join to `training_programs` is inner by design: the schema forbids a
 * finding without a programme, so a row that failed to join would be a bug we
 * want to see rather than a risk score displayed with no recommended action.
 */
export function listFindings(db: DatabaseSync, runId: number): Finding[] {
  const rows = db.prepare(`
    SELECT
      f.id, f.run_id, f.role_id, r.slug AS role_slug, r.label, f.headcount,
      f.machinery_plan_id, m.machine_name, m.arrival_date, f.months_until_impact,
      f.risk_score, f.risk_band, f.rationale, f.source_ref, f.confidence, f.workers_affected,
      f.training_program_id, t.name AS program_name, t.provider, t.duration_weeks,
      t.seats_per_month, t.cost_per_seat_bdt,
      f.cohorts_required, f.start_by_date, f.schedule_status, f.days_until_start_by, f.estimated_cost_bdt,
      f.workers_created, f.net_workforce_change, f.derived_from_catalogue, f.machine_type_name,
      f.health_safety_note, f.monthly_labour_saving_bdt, f.capital_cost_bdt, f.payback_months,
      f.retraining_cost_ratio, f.score_source
    FROM findings f
    JOIN roles r             ON r.id = f.role_id
    JOIN machinery_plans m   ON m.id = f.machinery_plan_id
    JOIN training_programs t ON t.id = f.training_program_id
    WHERE f.run_id = ?
    ORDER BY f.days_until_start_by, f.risk_score DESC, r.sort_order
  `).all(runId) as Row[];

  return rows.map((row) => ({
    id: num(row, 'id'),
    runId: num(row, 'run_id'),
    roleId: num(row, 'role_id'),
    roleSlug: str(row, 'role_slug'),
    roleLabel: str(row, 'label'),
    headcount: num(row, 'headcount'),
    machineryPlanId: num(row, 'machinery_plan_id'),
    machineName: str(row, 'machine_name'),
    arrivalDate: str(row, 'arrival_date'),
    monthsUntilImpact: num(row, 'months_until_impact'),
    riskScore: num(row, 'risk_score'),
    riskBand: enumOf(row, 'risk_band', BANDS),
    rationale: str(row, 'rationale'),
    sourceRef: str(row, 'source_ref'),
    confidence: enumOf(row, 'confidence', CONFIDENCES),
    workersAffected: num(row, 'workers_affected'),
    trainingProgramId: num(row, 'training_program_id'),
    trainingProgramName: str(row, 'program_name'),
    trainingProvider: str(row, 'provider'),
    trainingDurationWeeks: num(row, 'duration_weeks'),
    trainingSeatsPerMonth: num(row, 'seats_per_month'),
    trainingCostPerSeatBdt: num(row, 'cost_per_seat_bdt'),
    cohortsRequired: num(row, 'cohorts_required'),
    startByDate: str(row, 'start_by_date'),
    scheduleStatus: enumOf(row, 'schedule_status', STATUSES),
    daysUntilStartBy: num(row, 'days_until_start_by'),
    estimatedCostBdt: num(row, 'estimated_cost_bdt'),
    workersCreated: num(row, 'workers_created'),
    netWorkforceChange: num(row, 'net_workforce_change'),
    derivedFromCatalogue: num(row, 'derived_from_catalogue') === 1,
    machineTypeName: row['machine_type_name'] === null ? null : str(row, 'machine_type_name'),
    healthSafetyNote: row['health_safety_note'] === null ? null : str(row, 'health_safety_note'),
    monthlyLabourSavingBdt: num(row, 'monthly_labour_saving_bdt'),
    capitalCostBdt: num(row, 'capital_cost_bdt'),
    paybackMonths: row['payback_months'] === null ? null : num(row, 'payback_months'),
    retrainingCostRatio: row['retraining_cost_ratio'] === null ? null : num(row, 'retraining_cost_ratio'),
    scoreSource: str(row, 'score_source') === 'model' ? 'model' : 'rules',
  }));
}
