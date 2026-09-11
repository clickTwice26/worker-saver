/**
 * Training: build a dataset from recorded outcomes, search a small set of
 * candidate models, cross-validate each, and decide whether the winner deserves
 * to replace the rule engine.
 *
 * The gate matters more than the fit. A model that cannot beat the lookup table
 * it replaces is not an improvement — it is the same answer with less
 * explanation — so `beatsBaseline` decides whether it goes into production, and
 * a model that fails simply is not activated.
 */

import type { DatabaseSync } from 'node:sqlite';
import { fit, predict, type Dataset, type LogisticModel } from './logistic.ts';
import { fitTrees, predictTrees, treeImportance, type TreeModel } from './trees.ts';
import {
  auc, aucConfidenceInterval, calibrationCurve, evaluate, groupedStratifiedFolds,
  stratifiedFolds, type CalibrationBin, type Metrics,
} from './metrics.ts';
import { FEATURE_NAMES, toFeatureRow } from './features.ts';
import { num, str, type Row } from '../repositories/row.ts';

/** Below this, a fit is noise. Reported honestly rather than attempted. */
export const MIN_SAMPLES = 40;
/** Both classes need enough examples for a fold to mean anything. */
export const MIN_PER_CLASS = 8;
const FOLDS = 5;

/**
 * Rows used for fitting, above which the dataset is subsampled.
 *
 * Full-batch gradient descent is O(iterations x rows x features), and the
 * search runs it for every candidate on every fold. At a million rows that is
 * tens of billions of operations for a model whose coefficients stopped moving
 * long before. At 25,000 rows the standard error on an AUC estimate is about
 * 0.006 — far tighter than any decision made from it — so the remaining rows
 * buy decimal places and cost minutes of wall clock.
 *
 * The sample is taken by whole worker group, so subsampling cannot split one
 * person across the train/test boundary any more than the folds can. The status
 * response reports rows used against rows available, because a model quietly
 * trained on a tenth of the data would be a misleading thing to hide.
 */
export const MAX_TRAINING_ROWS = 25_000;

export type Target = 'displacement' | 'retraining_success';

export interface TrainingData extends Dataset {
  /** The rule engine's score for each row, on the same 0-1 scale. */
  baseline: number[];
  /**
   * Worker reference per row, so folds never split one person across sides.
   * Optional: omit it only when every row is genuinely independent.
   */
  groups?: string[];
}

export type Algorithm = 'logistic_regression_l2' | 'gradient_boosted_stumps';

export interface Candidate {
  algorithm: Algorithm;
  hyperparameters: Record<string, number | boolean>;
  auc: number | null;
  brier: number;
  recall: number;
}

/**
 * The candidate grid.
 *
 * Deliberately small. A wide search over a few hundred rows finds the
 * configuration that best fits this particular sample, which is overfitting
 * with extra steps.
 */
const CANDIDATES: Array<{ algorithm: Algorithm; hyperparameters: Record<string, number | boolean> }> = [
  // `iterations` is an upper bound; fitting stops as soon as the gradient
  // settles, and with standardised features that happens in a few hundred
  // steps. The earlier 4,000-step budget was almost never reached early.
  { algorithm: 'logistic_regression_l2', hyperparameters: { l2: 0.1, balanceClasses: true, iterations: 600, tolerance: 1e-5 } },
  { algorithm: 'logistic_regression_l2', hyperparameters: { l2: 1, balanceClasses: true, iterations: 600, tolerance: 1e-5 } },
  { algorithm: 'logistic_regression_l2', hyperparameters: { l2: 10, balanceClasses: true, iterations: 600, tolerance: 1e-5 } },
  { algorithm: 'gradient_boosted_stumps', hyperparameters: { rounds: 60, learningRate: 0.1 } },
  { algorithm: 'gradient_boosted_stumps', hyperparameters: { rounds: 140, learningRate: 0.06 } },
];

export type FittedModel =
  | { algorithm: 'logistic_regression_l2'; logistic: LogisticModel }
  | { algorithm: 'gradient_boosted_stumps'; trees: TreeModel };

function fitCandidate(
  algorithm: Algorithm, hyperparameters: Record<string, number | boolean>,
  x: number[][], y: number[], featureNames: string[],
): FittedModel {
  if (algorithm === 'logistic_regression_l2') {
    return { algorithm, logistic: fit({ x, y, featureNames }, hyperparameters as never) };
  }
  return { algorithm, trees: fitTrees(x, y, featureNames, hyperparameters as never) };
}

export function scoreModel(model: FittedModel, features: number[]): number {
  return model.algorithm === 'logistic_regression_l2'
    ? predict(model.logistic, features)
    : predictTrees(model.trees, features);
}

/**
 * Assemble the dataset from recorded outcomes.
 *
 * For displacement, `displaced` is the positive class and `redeployed` counts
 * as retained: the worker kept a job, which is the outcome the product exists
 * to produce. For retraining success the positive class is a pass, and rows
 * where nobody was enrolled are excluded rather than counted as failures.
 */
export function buildDataset(
  db: DatabaseSync, factoryId: number | null, target: Target = 'displacement',
): TrainingData {
  const rows = db.prepare(`
    SELECT
      o.worker_ref, o.outcome, o.retraining_result,
      o.tenure_months, o.operations_known, o.skill_grade, o.trained_before_arrival,
      o.primary_operation_share, o.time_to_competency_weeks,
      o.prior_trainings, o.prior_trainings_passed, o.literacy_level, o.digital_comfort,
      op.automatability AS op_automatability,
      (SELECT MAX(k.base_score) FROM risk_rules k WHERE k.role_id = o.role_id) AS role_base_risk,
      (SELECT i.workers_displaced_per_unit FROM machine_role_impact i
        WHERE i.machine_type_id = o.machine_type_id AND i.role_id = o.role_id) AS displaced_per_unit
    FROM outcomes o
    LEFT JOIN operations op ON op.id = o.primary_operation_id
    ${factoryId === null ? '' : 'WHERE o.factory_id = ?'}
    ORDER BY o.id
  `).all(...(factoryId === null ? [] : [factoryId])) as Row[];

  const x: number[][] = [];
  const y: number[] = [];
  const baseline: number[] = [];
  const groups: string[] = [];

  for (const row of rows) {
    if (target === 'retraining_success') {
      const result = row['retraining_result'];
      if (result !== 'passed' && result !== 'failed') continue;
    }

    const roleBaseRisk = row['role_base_risk'] === null ? null : num(row, 'role_base_risk');

    x.push(toFeatureRow({
      tenureMonths: row['tenure_months'] === null ? null : num(row, 'tenure_months'),
      operationsKnown: row['operations_known'] === null ? null : num(row, 'operations_known'),
      skillGrade: str(row, 'skill_grade'),
      operationAutomatability: row['op_automatability'] === null ? null : num(row, 'op_automatability'),
      primaryOperationShare: row['primary_operation_share'] === null ? null : num(row, 'primary_operation_share'),
      timeToCompetencyWeeks: row['time_to_competency_weeks'] === null ? null : num(row, 'time_to_competency_weeks'),
      priorTrainings: num(row, 'prior_trainings'),
      priorTrainingsPassed: num(row, 'prior_trainings_passed'),
      literacyLevel: str(row, 'literacy_level'),
      digitalComfort: str(row, 'digital_comfort'),
      machineDisplacementPerUnit: row['displaced_per_unit'] === null ? null : num(row, 'displaced_per_unit'),
      roleBaseRisk,
      trainedBeforeArrival: num(row, 'trained_before_arrival') === 1,
    }));

    y.push(target === 'displacement'
      ? (str(row, 'outcome') === 'displaced' ? 1 : 0)
      : (str(row, 'retraining_result') === 'passed' ? 1 : 0));

    // What the rule engine would have said, as a probability. For retraining
    // success the rules have no opinion, so the base rate is the fair baseline.
    baseline.push(target === 'displacement' ? (roleBaseRisk ?? 50) / 100 : 0.5);
    groups.push(str(row, 'worker_ref'));
  }

  return { x, y, baseline, groups, featureNames: [...FEATURE_NAMES] };
}

export interface TrainingResult {
  status: 'trained' | 'insufficient_data';
  reason?: string;
  target: Target;
  /** Rows available before subsampling; equals nSamples when none was needed. */
  nAvailable?: number;
  sampled?: boolean;
  model?: FittedModel;
  algorithm?: Algorithm;
  hyperparameters?: Record<string, number | boolean>;
  metrics?: Metrics;
  aucCi?: { low: number; high: number } | null;
  calibration?: CalibrationBin[];
  permutationImportance?: Array<{ feature: string; weight: number }>;
  learningCurve?: Array<{ n: number; auc: number | null }>;
  candidates?: Candidate[];
  baselineAuc?: number | null;
  beatsBaseline?: boolean;
  nSamples: number;
  nPositive: number;
  folds: number;
}

/** Out-of-fold predictions for one candidate, using group-aware folds. */
function crossValidate(
  data: TrainingData, folds: number[], algorithm: Algorithm,
  hyperparameters: Record<string, number | boolean>,
): number[] {
  const n = data.y.length;
  const outOfFold = new Array<number>(n).fill(0);

  for (let k = 0; k < FOLDS; k += 1) {
    const trainX: number[][] = [];
    const trainY: number[] = [];
    for (let i = 0; i < n; i += 1) {
      if (folds[i] !== k) { trainX.push(data.x[i]!); trainY.push(data.y[i]!); }
    }
    // A fold that holds only one class cannot train anything useful.
    const positives = trainY.reduce((a, b) => a + b, 0);
    if (trainY.length === 0 || positives === 0 || positives === trainY.length) continue;

    const model = fitCandidate(algorithm, hyperparameters, trainX, trainY, data.featureNames);
    for (let i = 0; i < n; i += 1) {
      if (folds[i] === k) outOfFold[i] = scoreModel(model, data.x[i]!);
    }
  }
  return outOfFold;
}

/**
 * Permutation importance.
 *
 * Shuffle one feature and measure how far AUC falls. More honest than reading
 * coefficients: it reports what the model actually relies on, works the same
 * way for both algorithms, and a feature the model ignores scores zero however
 * large its coefficient looks.
 */
function permutationImportance(
  model: FittedModel, xAll: number[][], yAll: number[], featureNames: string[], seed = 99,
): Array<{ feature: string; weight: number }> {
  // Ranking features does not need every row: this re-scores the whole set once
  // per feature, so a sample keeps it linear in features rather than in rows.
  const cap = 10_000;
  const x = xAll.length > cap ? xAll.slice(0, cap) : xAll;
  const y = yAll.length > cap ? yAll.slice(0, cap) : yAll;

  const baseScores = x.map((row) => scoreModel(model, row));
  const baseAuc = auc(baseScores, y);
  if (baseAuc === null) return [];

  let state = seed;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  return featureNames
    .map((feature, j) => {
      const column = x.map((row) => row[j]!);
      const shuffled = [...column];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const swap = Math.floor(next() * (i + 1));
        [shuffled[i], shuffled[swap]] = [shuffled[swap]!, shuffled[i]!];
      }
      const permutedScores = x.map((row, i) => {
        const copy = [...row];
        copy[j] = shuffled[i]!;
        return scoreModel(model, copy);
      });
      const permutedAuc = auc(permutedScores, y);
      return { feature, weight: permutedAuc === null ? 0 : baseAuc - permutedAuc };
    })
    .sort((a, b) => b.weight - a.weight);
}

/**
 * How performance moves with sample size.
 *
 * The practical question a factory has is whether recording more outcomes is
 * worth the effort. A curve still climbing at the right-hand end says yes; one
 * that has flattened says the limit is the features, not the volume.
 */
function learningCurve(
  data: TrainingData, folds: number[], algorithm: Algorithm,
  hyperparameters: Record<string, number | boolean>, fullAuc: number | null,
): Array<{ n: number; auc: number | null }> {
  const n = data.y.length;
  const points: Array<{ n: number; auc: number | null }> = [];

  // The full-size point is the main cross-validation result, passed in rather
  // than recomputed: repeating it here doubled the cost of the search for a
  // number already in hand.
  for (const fraction of [0.25, 0.5, 0.75]) {
    const size = Math.max(MIN_SAMPLES, Math.floor(n * fraction));
    if (size > n) continue;

    const subset: TrainingData = {
      x: data.x.slice(0, size), y: data.y.slice(0, size),
      baseline: data.baseline.slice(0, size),
      ...(data.groups ? { groups: data.groups.slice(0, size) } : {}),
      featureNames: data.featureNames,
    };
    const positives = subset.y.reduce((a, b) => a + b, 0);
    if (positives < MIN_PER_CLASS || subset.y.length - positives < MIN_PER_CLASS) continue;

    const subFolds = folds.slice(0, size);
    points.push({ n: size, auc: auc(crossValidate(subset, subFolds, algorithm, hyperparameters), subset.y) });
  }
  points.push({ n, auc: fullAuc });
  return points;
}

/**
 * Take whole groups at random until the cap is reached.
 *
 * Deterministic, so a reported metric can be reproduced. Groups are kept intact
 * for the same reason the folds keep them intact: a worker appearing on both
 * sides of a split inflates every number.
 */
function subsampleByGroup(data: TrainingData, cap: number, seed = 4242): TrainingData {
  const groups = data.groups;
  if (!groups || groups.length !== data.y.length) {
    return {
      x: data.x.slice(0, cap), y: data.y.slice(0, cap),
      baseline: data.baseline.slice(0, cap), featureNames: data.featureNames,
    };
  }

  const byGroup = new Map<string, number[]>();
  groups.forEach((g, i) => {
    const bucket = byGroup.get(g);
    if (bucket) bucket.push(i);
    else byGroup.set(g, [i]);
  });

  let state = seed >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  const keys = [...byGroup.keys()];
  for (let i = keys.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [keys[i], keys[j]] = [keys[j]!, keys[i]!];
  }

  const picked: number[] = [];
  for (const key of keys) {
    if (picked.length >= cap) break;
    for (const i of byGroup.get(key)!) picked.push(i);
  }
  picked.sort((a, b) => a - b);

  return {
    x: picked.map((i) => data.x[i]!),
    y: picked.map((i) => data.y[i]!),
    baseline: picked.map((i) => data.baseline[i]!),
    groups: picked.map((i) => groups[i]!),
    featureNames: data.featureNames,
  };
}

export function train(input: TrainingData, target: Target = 'displacement'): TrainingResult {
  const nAvailable = input.y.length;
  const sampled = nAvailable > MAX_TRAINING_ROWS;
  const data = sampled ? subsampleByGroup(input, MAX_TRAINING_ROWS) : input;

  const nSamples = data.y.length;
  const nPositive = data.y.reduce((n, v) => n + v, 0);
  const nNegative = nSamples - nPositive;

  if (nSamples < MIN_SAMPLES) {
    return {
      status: 'insufficient_data', target, nSamples, nPositive, nAvailable, sampled,
      folds: FOLDS,
      reason: `Needs at least ${MIN_SAMPLES} recorded outcomes; have ${nSamples}.`,
    };
  }
  if (nPositive < MIN_PER_CLASS || nNegative < MIN_PER_CLASS) {
    return {
      status: 'insufficient_data', target, nSamples, nPositive, nAvailable, sampled,
      folds: FOLDS,
      reason:
        `Needs at least ${MIN_PER_CLASS} of each result; have ${nPositive} positive ` +
        `and ${nNegative} negative.`,
    };
  }

  // Group-aware so one worker's rows never straddle a fold boundary. A dataset
  // without groups — every row already an independent observation — falls back
  // to plain stratification rather than failing.
  const folds = data.groups && data.groups.length === nSamples
    ? groupedStratifiedFolds(data.y, data.groups, FOLDS)
    : stratifiedFolds(data.y, FOLDS);

  const evaluated: Array<{ candidate: Candidate; scores: number[] }> = [];
  for (const { algorithm, hyperparameters } of CANDIDATES) {
    const scores = crossValidate(data, folds, algorithm, hyperparameters);
    const metrics = evaluate(scores, data.y);
    evaluated.push({
      candidate: {
        algorithm, hyperparameters,
        auc: metrics.auc, brier: metrics.brier, recall: metrics.recall,
      },
      scores,
    });
  }

  // Selection on AUC, with Brier breaking ties toward the better-calibrated
  // model — two models that rank identically are not equally useful when the
  // number is read as a probability.
  const best = evaluated
    .slice()
    .sort((a, b) =>
      (b.candidate.auc ?? 0) - (a.candidate.auc ?? 0) || a.candidate.brier - b.candidate.brier)[0]!;

  const metrics = evaluate(best.scores, data.y);
  const baselineAuc = auc(data.baseline, data.y);
  const aucCi = aucConfidenceInterval(best.scores, data.y);

  // Ties go to the rules, and so does anything inside the noise: a model whose
  // interval covers the baseline has not demonstrated an improvement.
  const beatsBaseline =
    metrics.auc !== null && baselineAuc !== null
    && metrics.auc > baselineAuc
    && (aucCi === null || aucCi.low > baselineAuc);

  const model = fitCandidate(
    best.candidate.algorithm, best.candidate.hyperparameters, data.x, data.y, data.featureNames,
  );

  return {
    status: 'trained',
    target,
    model,
    algorithm: best.candidate.algorithm,
    hyperparameters: best.candidate.hyperparameters,
    metrics,
    aucCi,
    calibration: calibrationCurve(best.scores, data.y),
    permutationImportance: permutationImportance(model, data.x, data.y, data.featureNames),
    learningCurve: learningCurve(
      data, folds, best.candidate.algorithm, best.candidate.hyperparameters, metrics.auc,
    ),
    candidates: evaluated.map((e) => e.candidate),
    baselineAuc,
    beatsBaseline,
    nSamples,
    nPositive,
    nAvailable,
    sampled,
    folds: FOLDS,
  };
}

/** Coefficients or split gains, whichever the winning algorithm provides. */
export function modelInfluence(model: FittedModel): Array<{ feature: string; weight: number }> {
  if (model.algorithm === 'gradient_boosted_stumps') return treeImportance(model.trees);
  return model.logistic.featureNames
    .map((feature, j) => ({ feature, weight: model.logistic.weights[j]! }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}
