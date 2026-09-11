/**
 * The analysis engine.
 *
 * A pure function of (roster, machinery plans, knowledge base, as-of date).
 * No database access, no clock reads, no randomness — the same input produces
 * the same output forever, which is what makes `tests/engine.golden.test.ts`
 * able to detect an unintended change to any rule.
 *
 * There is deliberately no machine learning here. The knowledge base is the
 * intelligence; this file is the arithmetic that turns it into a schedule.
 */

import type { RiskBand, Confidence, ScheduleStatus } from '@ale/shared';
import { addDays, approximateMonths, daysBetween } from '../lib/dates.ts';

/** Days of lead time attributed to each cohort beyond the first. */
const COHORT_INTAKE_DAYS = 30;

/**
 * Total lead time a training plan needs before the machine lands.
 *
 * Cohorts run back to back at one intake per month, and the final cohort still
 * needs the full programme duration to finish. Exported because the buyer report
 * needs the same figure to state a completion date — computing it twice is how
 * the two drift apart.
 */
export function leadTimeDays(cohorts: number, durationWeeks: number): number {
  return Math.max(0, cohorts - 1) * COHORT_INTAKE_DAYS + durationWeeks * 7;
}
/** Inside this many days of the start-by date, a cohort is flagged as urgent. */
const STARTS_SOON_DAYS = 30;

export interface EngineRole {
  id: number;
  slug: string;
  label: string;
}

export interface EngineHeadcount {
  roleId: number;
  headcount: number;
}

export interface EngineMachineryPlan {
  id: number;
  machineName: string;
  machineTypeId: number | null;
  affectedRoleId: number;
  arrivalDate: string;
  units: number;
  /** Null means the catalogue governs; a value is a deliberate override. */
  headcountDisplacedPerUnit: number | null;
}

/** The catalogue entry behind a plan, where one is linked. */
export interface EngineMachineType {
  id: number;
  name: string;
  capitalCostBdt: number;
  healthSafetyNote: string | null;
  /** Per-unit effect on each role this machine touches. */
  impact: Array<{ roleId: number; displacedPerUnit: number; createdPerUnit: number }>;
}

export interface EngineWageBand {
  roleId: number;
  monthlyCostBdt: number;
}

/**
 * A model-supplied displacement probability for a role, 0-1.
 *
 * Supplied only when a trained model is active for the factory. When absent the
 * rule score governs, which is the normal state until enough outcomes exist to
 * justify anything else.
 */
export interface EngineModelScore {
  roleId: number;
  probability: number;
}

export interface EngineRiskRule {
  roleId: number;
  machineTrigger: string;
  baseScore: number;
  band: RiskBand;
  rationale: string;
  sourceRef: string;
  confidence: Confidence;
}

export interface EngineTrainingProgram {
  id: number;
  name: string;
  targetRoleId: number;
  durationWeeks: number;
  seatsPerMonth: number;
  costPerSeatBdt: number;
  provider: string;
}

export interface EngineInput {
  asOfDate: string;
  roles: EngineRole[];
  headcounts: EngineHeadcount[];
  machineryPlans: EngineMachineryPlan[];
  riskRules: EngineRiskRule[];
  trainingPrograms: EngineTrainingProgram[];
  machineTypes: EngineMachineType[];
  wageBands: EngineWageBand[];
  /** Empty unless a trained model is active. */
  modelScores?: EngineModelScore[];
}

/** A finding before it is given a database id. */
export interface ComputedFinding {
  roleId: number;
  machineryPlanId: number;
  trainingProgramId: number;
  headcount: number;
  riskScore: number;
  riskBand: RiskBand;
  rationale: string;
  sourceRef: string;
  confidence: Confidence;
  monthsUntilImpact: number;
  workersAffected: number;
  workersCreated: number;
  netWorkforceChange: number;
  derivedFromCatalogue: boolean;
  machineTypeName: string | null;
  healthSafetyNote: string | null;
  monthlyLabourSavingBdt: number;
  capitalCostBdt: number;
  paybackMonths: number | null;
  retrainingCostRatio: number | null;
  /** Which engine produced `riskScore`. */
  scoreSource: 'rules' | 'model';
  cohortsRequired: number;
  startByDate: string;
  scheduleStatus: ScheduleStatus;
  daysUntilStartBy: number;
  estimatedCostBdt: number;
}

/**
 * A machinery plan the engine could not answer for.
 *
 * Reported rather than silently dropped, and never emitted as a score. A role
 * with no training programme would otherwise become a bare displaceability
 * figure, which this product does not produce — see docs/ethics.md.
 */
export interface CoverageGap {
  machineryPlanId: number;
  machineName: string;
  roleId: number;
  reason: 'no_risk_rule' | 'no_training_program' | 'no_headcount';
}

export interface EngineResult {
  findings: ComputedFinding[];
  gaps: CoverageGap[];
  /** Headcount-weighted mean base score across the whole roster, 0–100. */
  weightedRiskScore: number;
}

export function analyze(input: EngineInput): EngineResult {
  const { asOfDate } = input;

  const headcountByRole = new Map(input.headcounts.map((h) => [h.roleId, h.headcount]));
  const rulesByRole = groupBy(input.riskRules, (r) => r.roleId);
  const programsByRole = groupBy(input.trainingPrograms, (p) => p.targetRoleId);
  const machineTypeById = new Map(input.machineTypes.map((m) => [m.id, m]));
  const wageByRole = new Map(input.wageBands.map((w) => [w.roleId, w.monthlyCostBdt]));
  const modelByRole = new Map((input.modelScores ?? []).map((m) => [m.roleId, m.probability]));

  const findings: ComputedFinding[] = [];
  const gaps: CoverageGap[] = [];

  // Sorted so output order never depends on the database's row order.
  const plans = [...input.machineryPlans].sort(
    (a, b) => a.arrivalDate.localeCompare(b.arrivalDate) || a.id - b.id,
  );

  for (const plan of plans) {
    const headcount = headcountByRole.get(plan.affectedRoleId) ?? 0;
    if (headcount === 0) {
      gaps.push({ machineryPlanId: plan.id, machineName: plan.machineName, roleId: plan.affectedRoleId, reason: 'no_headcount' });
      continue;
    }

    // Where a role has several rules, the most exposed one governs planning.
    const rule = pickHighestScore(rulesByRole.get(plan.affectedRoleId));
    if (!rule) {
      gaps.push({ machineryPlanId: plan.id, machineName: plan.machineName, roleId: plan.affectedRoleId, reason: 'no_risk_rule' });
      continue;
    }

    // The constraint that keeps a score from ever standing alone.
    const program = pickShortestPath(programsByRole.get(plan.affectedRoleId));
    if (!program) {
      gaps.push({ machineryPlanId: plan.id, machineName: plan.machineName, roleId: plan.affectedRoleId, reason: 'no_training_program' });
      continue;
    }

    const machineType = plan.machineTypeId === null
      ? undefined
      : machineTypeById.get(plan.machineTypeId);

    // The catalogue is the default source of the displacement figure; a value on
    // the plan is a deliberate override by a factory that knows its own line
    // better than the reference data does.
    const cataloguePerUnit = machineType?.impact
      .find((i) => i.roleId === plan.affectedRoleId)?.displacedPerUnit;
    const displacedPerUnit = plan.headcountDisplacedPerUnit ?? cataloguePerUnit ?? 0;
    const derivedFromCatalogue = plan.headcountDisplacedPerUnit === null && cataloguePerUnit !== undefined;

    const workersAffected = Math.min(headcount, Math.round(plan.units * displacedPerUnit));

    // The half the original model could not express: the same machine creates
    // posts to run and service it. A plan reporting only displacement is
    // telling half the truth.
    const createdPerUnit = machineType?.impact
      .find((i) => i.roleId === plan.affectedRoleId)?.createdPerUnit ?? 0;
    const workersCreated = Math.round(plan.units * createdPerUnit);

    const netWorkforceChange = workersCreated - workersAffected;

    // Payback rests on the net wage bill removed, not the gross: the posts the
    // machine creates still have to be paid for.
    const monthlyCost = wageByRole.get(plan.affectedRoleId) ?? 0;
    const monthlyLabourSavingBdt = Math.max(0, -netWorkforceChange) * monthlyCost;
    const capitalCostBdt = plan.units * (machineType?.capitalCostBdt ?? 0);
    const paybackMonths = monthlyLabourSavingBdt > 0 && capitalCostBdt > 0
      ? Math.ceil(capitalCostBdt / monthlyLabourSavingBdt)
      : null;

    const cohortsRequired = Math.max(1, Math.ceil(workersAffected / program.seatsPerMonth));

    const leadDays = leadTimeDays(cohortsRequired, program.durationWeeks);
    const startByDate = addDays(plan.arrivalDate, -leadDays);
    const daysUntilStartBy = daysBetween(asOfDate, startByDate);

    // A model score replaces the rule score only where one exists; the band and
    // the rationale still come from the knowledge base, so a model number is
    // never shown without an explanation beside it.
    const modelProbability = modelByRole.get(plan.affectedRoleId);
    const riskScore = modelProbability === undefined
      ? rule.baseScore
      : Math.round(modelProbability * 100);

    findings.push({
      roleId: plan.affectedRoleId,
      machineryPlanId: plan.id,
      trainingProgramId: program.id,
      headcount,
      riskScore,
      riskBand: rule.band,
      scoreSource: modelProbability === undefined ? 'rules' : 'model',
      rationale: rule.rationale,
      sourceRef: rule.sourceRef,
      confidence: rule.confidence,
      monthsUntilImpact: approximateMonths(asOfDate, plan.arrivalDate),
      workersAffected,
      workersCreated,
      netWorkforceChange,
      derivedFromCatalogue,
      machineTypeName: machineType?.name ?? null,
      healthSafetyNote: machineType?.healthSafetyNote ?? null,
      monthlyLabourSavingBdt,
      capitalCostBdt,
      paybackMonths,
      cohortsRequired,
      startByDate,
      scheduleStatus: classify(daysUntilStartBy),
      daysUntilStartBy,
      estimatedCostBdt: workersAffected * program.costPerSeatBdt,
      // Training bill against one year of the wage bill it protects. Below 1.0,
      // retraining costs less than a year of the payroll it keeps in work.
      retrainingCostRatio: monthlyCost > 0 && workersAffected > 0
        ? Number(((workersAffected * program.costPerSeatBdt) / (workersAffected * monthlyCost * 12)).toFixed(3))
        : null,
    });
  }

  return { findings, gaps, weightedRiskScore: weightedRisk(input) };
}

function classify(daysUntilStartBy: number): ScheduleStatus {
  if (daysUntilStartBy < 0) return 'overdue';
  if (daysUntilStartBy <= STARTS_SOON_DAYS) return 'starts_soon';
  return 'on_track';
}

/**
 * Headcount-weighted mean of each role's base risk score.
 *
 * Deliberately independent of the machinery plans: it describes the exposure of
 * the workforce as it stands, which is the figure that belongs at the top of the
 * dashboard, while the findings below it describe committed purchases.
 */
function weightedRisk(input: EngineInput): number {
  const rulesByRole = groupBy(input.riskRules, (r) => r.roleId);
  let weighted = 0;
  let total = 0;

  for (const { roleId, headcount } of input.headcounts) {
    const rule = pickHighestScore(rulesByRole.get(roleId));
    if (!rule || headcount <= 0) continue;
    weighted += rule.baseScore * headcount;
    total += headcount;
  }

  return total === 0 ? 0 : Math.round(weighted / total);
}

function pickHighestScore(rules: EngineRiskRule[] | undefined): EngineRiskRule | undefined {
  if (!rules?.length) return undefined;
  return [...rules].sort(
    (a, b) => b.baseScore - a.baseScore || a.machineTrigger.localeCompare(b.machineTrigger),
  )[0];
}

/** Prefer the programme that gets people through fastest, then the cheapest. */
function pickShortestPath(programs: EngineTrainingProgram[] | undefined): EngineTrainingProgram | undefined {
  if (!programs?.length) return undefined;
  return [...programs].sort(
    (a, b) => a.durationWeeks - b.durationWeeks || a.costPerSeatBdt - b.costPerSeatBdt || a.id - b.id,
  )[0];
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}
