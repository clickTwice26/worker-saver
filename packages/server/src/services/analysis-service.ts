/**
 * Orchestration between the database and the engine.
 *
 * The engine itself stays pure; everything that reads a clock or touches SQL
 * lives here, which is what lets the golden test drive the engine directly with
 * a fixed `asOfDate`.
 */

import type { DatabaseSync } from 'node:sqlite';
import type { AnalysisRun, TransitionPlan, TransitionReport, ReportCommitment } from '@ale/shared';
import {
  analyze, buildSchedule, computeTotals, computeRulesVersion, leadTimeDays, ENGINE_VERSION,
} from '../engine/index.ts';
import type { CoverageGap, EngineInput } from '../engine/analyze.ts';
import { transaction } from '../db/index.ts';
import { addDays, today } from '../lib/dates.ts';
import * as reference from '../repositories/reference.ts';
import * as factoryRepo from '../repositories/factory.ts';
import * as analysisRepo from '../repositories/analysis.ts';
import { getActiveModel, scoreWith } from './model-service.ts';

export interface RunOutcome {
  run: AnalysisRun;
  gaps: CoverageGap[];
}

/** Assemble engine input from the database. */
function collectInput(db: DatabaseSync, factoryId: number, asOfDate: string): EngineInput {
  const roles = reference.listRoles(db);
  const headcounts = factoryRepo.listHeadcounts(db, factoryId);
  const plans = factoryRepo.listMachineryPlans(db, factoryId);

  return {
    asOfDate,
    roles: roles.map((r) => ({ id: r.id, slug: r.slug, label: r.label })),
    headcounts: headcounts.map((h) => ({ roleId: h.roleId, headcount: h.headcount })),
    machineryPlans: plans.map((p) => ({
      id: p.id,
      machineName: p.machineName,
      machineTypeId: p.machineTypeId,
      affectedRoleId: p.affectedRoleId,
      arrivalDate: p.arrivalDate,
      units: p.units,
      headcountDisplacedPerUnit: p.headcountDisplacedPerUnit,
    })),
    machineTypes: reference.listMachineTypes(db).map((m) => ({
      id: m.id,
      name: m.name,
      capitalCostBdt: m.capitalCostBdt,
      healthSafetyNote: m.healthSafetyNote,
      impact: m.impact.map((i) => ({
        roleId: i.roleId,
        displacedPerUnit: i.displacedPerUnit,
        createdPerUnit: i.createdPerUnit,
      })),
    })),
    wageBands: reference.listWageBands(db),
    modelScores: buildModelScores(db, factoryId, headcounts.map((h) => h.roleId)),
    riskRules: reference.listRiskRules(db).map((k) => ({
      roleId: k.roleId,
      machineTrigger: k.machineTrigger,
      baseScore: k.baseScore,
      band: k.band,
      rationale: k.rationale,
      sourceRef: k.sourceRef,
      confidence: k.confidence,
    })),
    trainingPrograms: reference.listTrainingPrograms(db).map((t) => ({
      id: t.id,
      name: t.name,
      targetRoleId: t.targetRoleId,
      durationWeeks: t.durationWeeks,
      seatsPerMonth: t.seatsPerMonth,
      costPerSeatBdt: t.costPerSeatBdt,
      provider: t.provider,
    })),
  };
}

/**
 * Per-role displacement probabilities from the active model.
 *
 * Returns nothing when no model is active, which is the normal state until a
 * factory has recorded enough outcomes for one to beat the rule baseline.
 *
 * Scoring is role-level for now: the model is fitted on worker-level features,
 * but a finding describes a role, so the role's median worker is scored. Once
 * the interface presents per-worker plans this becomes a per-worker call.
 */
function buildModelScores(
  db: DatabaseSync, factoryId: number, roleIds: number[],
): Array<{ roleId: number; probability: number }> {
  const model = getActiveModel(db, factoryId);
  if (!model) return [];

  const rules = reference.listRiskRules(db);
  const baseByRole = new Map<number, number>();
  for (const rule of rules) {
    const held = baseByRole.get(rule.roleId);
    if (held === undefined || rule.baseScore > held) baseByRole.set(rule.roleId, rule.baseScore);
  }

  return roleIds.map((roleId) => {
    const profile = db.prepare(`
      SELECT
        CAST(AVG(w.tenure_months) AS INTEGER) AS tenure_months,
        CAST(AVG(w.operations_known) AS INTEGER) AS operations_known,
        AVG(o.automatability) AS automatability
      FROM workers w
      LEFT JOIN operations o ON o.id = w.primary_operation_id
      WHERE w.factory_id = ? AND w.role_id = ?
    `).get(factoryId, roleId) as Record<string, unknown>;

    const asNumber = (key: string): number | null =>
      typeof profile[key] === 'number' ? (profile[key] as number) : null;

    const probability = scoreWith(model, {
      tenureMonths: asNumber('tenure_months'),
      operationsKnown: asNumber('operations_known'),
      skillGrade: 'semi_skilled',
      operationAutomatability: asNumber('automatability'),
      primaryOperationShare: asNumber('operation_share'),
      timeToCompetencyWeeks: asNumber('competency_weeks'),
      priorTrainings: asNumber('prior_trainings'),
      priorTrainingsPassed: asNumber('prior_trainings_passed'),
      literacyLevel: 'unknown',
      digitalComfort: 'unknown',
      machineDisplacementPerUnit: null,
      roleBaseRisk: baseByRole.get(roleId) ?? null,
      trainedBeforeArrival: false,
    });

    // A stored model without a usable payload scores nothing rather than
    // silently falling back to a number nobody can trace.
    return probability === null ? null : { roleId, probability };
  }).flatMap((entry) => (entry === null ? [] : [entry]));
}

/**
 * Run the analysis and persist the result.
 *
 * Each execution appends a new run rather than overwriting the last, so a
 * report that has already been sent to a buyer stays reproducible.
 */
export function runAnalysis(
  db: DatabaseSync, factoryId: number, asOfDate: string = today(),
): RunOutcome {
  const input = collectInput(db, factoryId, asOfDate);
  const result = analyze(input);

  const runId = transaction(db, () => {
    const id = analysisRepo.insertRun(db, {
      factoryId,
      runAt: new Date().toISOString(),
      asOfDate,
      rulesVersion: computeRulesVersion(db),
      engineVersion: ENGINE_VERSION,
    });
    analysisRepo.insertFindings(db, id, result.findings);
    return id;
  });

  const run = analysisRepo.getRun(db, runId);
  if (!run) throw new Error(`Run ${runId} vanished immediately after insert`);

  return { run, gaps: result.gaps };
}

/** Assemble the full plan for a run: findings, calendar and headline figures. */
export function getPlan(db: DatabaseSync, run: AnalysisRun): TransitionPlan | null {
  const factory = factoryRepo.getFactory(db, run.factoryId);
  if (!factory) return null;

  const findings = analysisRepo.listFindings(db, run.id);
  const headcounts = factoryRepo.listHeadcounts(db, run.factoryId);

  // Recomputed from the stored roster so the headline figure always describes
  // the workforce as the run saw it.
  const { weightedRiskScore } = analyze(collectInput(db, run.factoryId, run.asOfDate));

  return {
    run,
    factory,
    roster: headcounts,
    findings,
    schedule: buildSchedule(findings, run.asOfDate),
    totals: computeTotals(findings, headcounts, weightedRiskScore),
  };
}

/** The latest plan for a factory, running the analysis first if none exists. */
export function getLatestPlan(db: DatabaseSync, factoryId: number): TransitionPlan | null {
  const run = analysisRepo.getLatestRun(db, factoryId) ?? runAnalysis(db, factoryId).run;
  return getPlan(db, run);
}

/**
 * Build the buyer-facing transition report.
 *
 * This is the only exportable document the API produces. It is a set of dated
 * training commitments — deliberately not a ranked risk list, which is the one
 * artifact this product must never hand anybody. See docs/ethics.md.
 */
export function buildReport(plan: TransitionPlan): TransitionReport {
  const commitments: ReportCommitment[] = plan.findings
    .slice()
    .sort((a, b) => a.startByDate.localeCompare(b.startByDate))
    .map((f) => ({
      roleLabel: f.roleLabel,
      workersAffected: f.workersAffected,
      trainingProgramName: f.trainingProgramName,
      startByDate: f.startByDate,
      // Shares the engine's arithmetic, so a commitment can never claim training
      // finishes after the machine it prepares for has already landed.
      completesByDate: addDays(
        f.startByDate, leadTimeDays(f.cohortsRequired, f.trainingDurationWeeks),
      ),
      costBdt: f.estimatedCostBdt,
    }));

  const estimated = plan.findings.filter((f) => f.confidence === 'estimated').length;

  return {
    plan,
    generatedAt: new Date().toISOString(),
    commitments,
    disclosure:
      `Prepared with ALE Insight v1. Risk scores are role-level and derived from a seeded knowledge base; ` +
      `${estimated} of ${plan.findings.length} findings rest on estimated rather than sourced figures. ` +
      `Training volumes assume the seat capacities recorded for each programme. ` +
      `This document records planned transitions and is not a redundancy assessment.`,
  };
}
