/**
 * Training a model and deciding whether to use it.
 *
 * The decision is the important part. A fitted model is stored either way, with
 * its cross-validated metrics and the rule engine's score on the same folds,
 * but it is only activated when it measurably beats the rules. That keeps the
 * product honest in the case that matters most: early on, when there is not yet
 * enough evidence to justify replacing a transparent lookup with a fitted one.
 */

import type { DatabaseSync } from 'node:sqlite';
import {
  buildDataset, train, modelInfluence, scoreModel, MIN_SAMPLES, MIN_PER_CLASS,
  type FittedModel, type Target,
} from '../ml/train.ts';
import type { CalibrationBin } from '../ml/metrics.ts';
import { toFeatureRow, type FeatureInput } from '../ml/features.ts';
import { num, str, type Row } from '../repositories/row.ts';

export interface StoredModel {
  id: number;
  factoryId: number | null;
  target: Target;
  algorithm: string;
  hyperparameters: Record<string, number | boolean>;
  featureNames: string[];
  nSamples: number;
  nPositive: number;
  folds: number;
  auc: number | null;
  aucCiLow: number | null;
  aucCiHigh: number | null;
  brier: number | null;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  baselineAuc: number | null;
  beatsBaseline: boolean;
  isActive: boolean;
  calibration: CalibrationBin[];
  permutationImportance: Array<{ feature: string; weight: number }>;
  learningCurve: Array<{ n: number; auc: number | null }>;
  candidates: Array<{ algorithm: string; hyperparameters: Record<string, unknown>; auc: number | null; brier: number; recall: number }>;
  trainedAt: string;
  notes: string;
  /** The serialised model itself, kept out of the API response. */
  payload: FittedModel | null;
}

export interface ModelStatus {
  status: 'no_data' | 'insufficient_data' | 'trained_not_active' | 'active';
  target: Target;
  message: string;
  outcomesRecorded: number;
  outcomesNeeded: number;
  displacedRecorded: number;
  retainedRecorded: number;
  /** Rows actually fitted, when the dataset was subsampled for tractability. */
  rowsUsed: number | null;
  sampled: boolean;
  model: StoredModel | null;
  influence: Array<{ feature: string; weight: number }>;
}

function parse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toStored(row: Row): StoredModel {
  const weights = parse<number[]>(str(row, 'weights'), []);
  const algorithm = str(row, 'algorithm');
  const featureNames = parse<string[]>(str(row, 'feature_names'), []);

  // The fitted object is stored in `weights` for trees and as coefficients for
  // logistic; both round-trip through the same column.
  let payload: FittedModel | null = null;
  if (algorithm === 'gradient_boosted_stumps') {
    const trees = parse<FittedModel | null>(str(row, 'weights'), null);
    payload = trees && 'stumps' in (trees as object)
      ? { algorithm: 'gradient_boosted_stumps', trees: trees as never }
      : null;
  } else if (weights.length > 0) {
    payload = {
      algorithm: 'logistic_regression_l2',
      logistic: {
        featureNames,
        weights,
        intercept: num(row, 'intercept'),
        means: parse<number[]>(str(row, 'feature_means'), []),
        stds: parse<number[]>(str(row, 'feature_stds'), []),
      },
    };
  }

  return {
    id: num(row, 'id'),
    factoryId: row['factory_id'] === null ? null : num(row, 'factory_id'),
    target: str(row, 'target') as Target,
    algorithm,
    hyperparameters: parse(str(row, 'hyperparameters'), {}),
    featureNames,
    nSamples: num(row, 'n_samples'),
    nPositive: num(row, 'n_positive'),
    folds: num(row, 'folds'),
    auc: row['auc'] === null ? null : num(row, 'auc'),
    aucCiLow: row['auc_ci_low'] === null ? null : num(row, 'auc_ci_low'),
    aucCiHigh: row['auc_ci_high'] === null ? null : num(row, 'auc_ci_high'),
    brier: row['brier'] === null ? null : num(row, 'brier'),
    accuracy: row['accuracy'] === null ? null : num(row, 'accuracy'),
    precision: row['precision_score'] === null ? null : num(row, 'precision_score'),
    recall: row['recall_score'] === null ? null : num(row, 'recall_score'),
    f1: row['f1_score'] === null ? null : num(row, 'f1_score'),
    baselineAuc: row['baseline_auc'] === null ? null : num(row, 'baseline_auc'),
    beatsBaseline: num(row, 'beats_baseline') === 1,
    isActive: num(row, 'is_active') === 1,
    calibration: parse(str(row, 'calibration'), []),
    permutationImportance: parse(str(row, 'permutation_importance'), []),
    learningCurve: parse(str(row, 'learning_curve'), []),
    candidates: parse(str(row, 'candidates'), []),
    trainedAt: str(row, 'trained_at'),
    notes: str(row, 'notes'),
    payload,
  };
}

/** The model in force for a factory, or null when the rules still govern. */
export function getActiveModel(
  db: DatabaseSync, factoryId: number, target: Target = 'displacement',
): StoredModel | null {
  const row = db.prepare(`
    SELECT * FROM ml_models
    WHERE is_active = 1 AND target = ? AND (factory_id = ? OR factory_id IS NULL)
    ORDER BY factory_id DESC, id DESC LIMIT 1
  `).get(target, factoryId) as Row | undefined;
  return row ? toStored(row) : null;
}

export function trainForFactory(
  db: DatabaseSync, factoryId: number, target: Target = 'displacement',
): ModelStatus {
  const data = buildDataset(db, factoryId, target);
  const result = train(data, target);

  if (result.status === 'insufficient_data') {
    return {
      status: data.y.length === 0 ? 'no_data' : 'insufficient_data',
      target,
      message: result.reason ?? 'Not enough recorded outcomes to train.',
      outcomesRecorded: result.nAvailable ?? result.nSamples,
      outcomesNeeded: Math.max(0, MIN_SAMPLES - result.nSamples),
      displacedRecorded: result.nPositive,
      retainedRecorded: result.nSamples - result.nPositive,
      rowsUsed: null,
      sampled: false,
      model: null,
      influence: [],
    };
  }

  const model = result.model!;
  const metrics = result.metrics!;

  // Logistic coefficients live in their own columns; a tree ensemble serialises
  // whole into `weights`, which keeps one storage path for both.
  const isLogistic = model.algorithm === 'logistic_regression_l2';
  const weightsJson = isLogistic
    ? JSON.stringify(model.logistic.weights)
    : JSON.stringify(model.trees);

  const modelId = Number(db.prepare(`
    INSERT INTO ml_models (
      factory_id, target, algorithm, hyperparameters, feature_names, weights, intercept,
      feature_means, feature_stds, n_samples, n_positive, folds,
      auc, auc_ci_low, auc_ci_high, brier, accuracy, precision_score, recall_score, f1_score,
      baseline_auc, beats_baseline, is_active, calibration, permutation_importance,
      learning_curve, candidates, trained_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    factoryId, target, result.algorithm!, JSON.stringify(result.hyperparameters ?? {}),
    JSON.stringify(data.featureNames), weightsJson,
    isLogistic ? model.logistic.intercept : 0,
    JSON.stringify(isLogistic ? model.logistic.means : []),
    JSON.stringify(isLogistic ? model.logistic.stds : []),
    result.nSamples, result.nPositive, result.folds,
    metrics.auc, result.aucCi?.low ?? null, result.aucCi?.high ?? null,
    metrics.brier, metrics.accuracy, metrics.precision, metrics.recall, metrics.f1,
    result.baselineAuc ?? null,
    result.beatsBaseline ? 1 : 0,
    result.beatsBaseline ? 1 : 0,
    JSON.stringify(result.calibration ?? []),
    JSON.stringify(result.permutationImportance ?? []),
    JSON.stringify(result.learningCurve ?? []),
    JSON.stringify(result.candidates ?? []),
    new Date().toISOString(),
    (result.beatsBaseline
      ? `Activated: out-of-fold AUC ${metrics.auc?.toFixed(3)} beats the rule baseline ` +
        `${result.baselineAuc?.toFixed(3)}, and the lower bound of its confidence interval stays above it.`
      : `Stored but not activated: ${metrics.auc?.toFixed(3)} against a rule baseline of ` +
        `${result.baselineAuc?.toFixed(3)} is not a demonstrated improvement.`)
    + (result.sampled
      ? ` Fitted on a ${result.nSamples.toLocaleString()}-row sample of ` +
        `${(result.nAvailable ?? result.nSamples).toLocaleString()} available, drawn by whole worker.`
      : ''),
  ).lastInsertRowid);

  // Only one model governs a factory and target at a time.
  if (result.beatsBaseline) {
    db.prepare('UPDATE ml_models SET is_active = 0 WHERE factory_id = ? AND target = ? AND id != ?')
      .run(factoryId, target, modelId);
  }

  const stored = toStored(db.prepare('SELECT * FROM ml_models WHERE id = ?').get(modelId) as Row);

  return {
    status: result.beatsBaseline ? 'active' : 'trained_not_active',
    target,
    message: stored.notes,
    outcomesRecorded: result.nAvailable ?? result.nSamples,
    outcomesNeeded: 0,
    displacedRecorded: result.nPositive,
    retainedRecorded: result.nSamples - result.nPositive,
    rowsUsed: result.nSamples,
    sampled: result.sampled ?? false,
    model: stored,
    influence: modelInfluence(model),
  };
}

/** Current status without refitting. */
export function getStatus(
  db: DatabaseSync, factoryId: number, target: Target = 'displacement',
): ModelStatus {
  const counts = db.prepare(`
    SELECT COUNT(*) AS total, SUM(CASE WHEN outcome = 'displaced' THEN 1 ELSE 0 END) AS displaced
    FROM outcomes WHERE factory_id = ?
  `).get(factoryId) as Row;

  const total = num(counts, 'total');
  const displaced = counts['displaced'] === null ? 0 : num(counts, 'displaced');

  const row = db.prepare('SELECT * FROM ml_models WHERE factory_id = ? AND target = ? ORDER BY id DESC LIMIT 1')
    .get(factoryId, target) as Row | undefined;
  const model = row ? toStored(row) : null;

  let status: ModelStatus['status'] = 'no_data';
  let message = 'No outcomes recorded yet. The rule engine is producing every score. ' +
    `Import ${MIN_SAMPLES} or more outcomes to train a model.`;

  if (model?.isActive) {
    status = 'active';
    message = model.notes;
  } else if (model) {
    status = 'trained_not_active';
    message = model.notes;
  } else if (total > 0) {
    status = 'insufficient_data';
    message = `${total} outcome${total === 1 ? '' : 's'} recorded. ` +
      `Training needs ${MIN_SAMPLES} rows with at least ${MIN_PER_CLASS} of each result.`;
  }

  return {
    status,
    target,
    message,
    outcomesRecorded: total,
    outcomesNeeded: Math.max(0, MIN_SAMPLES - total),
    displacedRecorded: displaced,
    retainedRecorded: total - displaced,
    rowsUsed: model?.nSamples ?? null,
    sampled: model !== null && model.nSamples < total,
    model,
    influence: model?.payload ? modelInfluence(model.payload) : [],
  };
}

/** Probability of the positive class, 0-1, from a stored model. */
export function scoreWith(model: StoredModel, input: FeatureInput): number | null {
  if (!model.payload) return null;
  return scoreModel(model.payload, toFeatureRow(input));
}
