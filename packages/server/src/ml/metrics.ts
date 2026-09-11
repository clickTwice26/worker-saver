/**
 * Evaluation metrics.
 *
 * Accuracy alone is close to useless here: if 85% of workers are retained, a
 * model that predicts "retained" for everyone scores 85% and has learned
 * nothing. AUC and Brier are reported alongside it for that reason.
 */

export interface Metrics {
  auc: number | null;
  brier: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  positiveRate: number;
  n: number;
}

export interface CalibrationBin {
  /** Bin midpoint of predicted probability. */
  predicted: number;
  /** Observed rate of the positive class in that bin. */
  observed: number;
  count: number;
}

/**
 * Area under the ROC curve, by rank statistic.
 *
 * Equivalent to the probability that a randomly chosen positive is scored above
 * a randomly chosen negative. Ties share the averaged rank, so a model that
 * outputs one constant for every row scores 0.5 rather than accidentally 1.
 */
export function auc(scores: number[], labels: number[]): number | null {
  const positives = labels.reduce((n, y) => n + y, 0);
  const negatives = labels.length - positives;
  // With only one class present the measure is undefined, not zero.
  if (positives === 0 || negatives === 0) return null;

  const order = scores
    .map((score, i) => ({ score, label: labels[i]! }))
    .sort((a, b) => a.score - b.score);

  const ranks = new Array<number>(order.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]!.score === order[i]!.score) j += 1;
    const averaged = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[k] = averaged;
    i = j + 1;
  }

  let rankSum = 0;
  for (let k = 0; k < order.length; k += 1) if (order[k]!.label === 1) rankSum += ranks[k]!;

  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

/** Mean squared error on probabilities. Rewards calibration, not just ranking. */
export function brier(scores: number[], labels: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s, i) => sum + (s - labels[i]!) ** 2, 0) / scores.length;
}

export function accuracy(scores: number[], labels: number[], threshold = 0.5): number {
  if (scores.length === 0) return 0;
  const correct = scores.reduce((n, s, i) => n + ((s >= threshold ? 1 : 0) === labels[i]! ? 1 : 0), 0);
  return correct / scores.length;
}

/**
 * Precision, recall and F1 at a threshold.
 *
 * Reported because accuracy hides the failure that matters: a model that never
 * predicts displacement has high accuracy and zero recall, and recall is the
 * number that says whether anyone at risk was actually found.
 */
export function precisionRecall(
  scores: number[], labels: number[], threshold = 0.5,
): { precision: number; recall: number; f1: number } {
  let tp = 0; let fp = 0; let fn = 0;
  for (let i = 0; i < scores.length; i += 1) {
    const predicted = scores[i]! >= threshold ? 1 : 0;
    if (predicted === 1 && labels[i] === 1) tp += 1;
    else if (predicted === 1) fp += 1;
    else if (labels[i] === 1) fn += 1;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

export function evaluate(scores: number[], labels: number[]): Metrics {
  const pr = precisionRecall(scores, labels);
  return {
    auc: auc(scores, labels),
    brier: brier(scores, labels),
    accuracy: accuracy(scores, labels),
    precision: pr.precision,
    recall: pr.recall,
    f1: pr.f1,
    positiveRate: labels.length === 0 ? 0 : labels.reduce((n, y) => n + y, 0) / labels.length,
    n: labels.length,
  };
}

/**
 * Bootstrap confidence interval for AUC.
 *
 * A single AUC from 60 rows and one from 6,000 look identical on a dashboard
 * and mean very different things. The interval is what stops a model being
 * promoted on a difference that is inside the noise.
 */
export function aucConfidenceInterval(
  scores: number[], labels: number[], resamples = 400, seed = 12345,
): { low: number; high: number } | null {
  const base = auc(scores, labels);
  if (base === null) return null;

  // Each resample sorts n rows, so the cost is O(resamples x n log n). Beyond a
  // few tens of thousands the interval is already narrow and the extra rows
  // only buy decimal places, so resamples are drawn at a capped size. The
  // interval this reports is therefore slightly conservative, which is the
  // right direction for a figure used to gate a model into production.
  const drawSize = Math.min(scores.length, 20_000);

  let state = seed;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const samples: number[] = [];
  for (let r = 0; r < resamples; r += 1) {
    const s: number[] = [];
    const l: number[] = [];
    for (let i = 0; i < drawSize; i += 1) {
      const pick = Math.floor(next() * scores.length);
      s.push(scores[pick]!);
      l.push(labels[pick]!);
    }
    const value = auc(s, l);
    // Resamples that happen to contain one class say nothing; drop them.
    if (value !== null) samples.push(value);
  }
  if (samples.length < 20) return null;

  samples.sort((a, b) => a - b);
  const at = (q: number): number => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))]!;
  return { low: at(0.025), high: at(0.975) };
}

/**
 * Calibration: does a predicted 0.7 actually happen 70% of the time?
 *
 * Ranking and calibration are different properties. A model can order workers
 * perfectly and still be systematically overconfident, which matters here
 * because the number is read as a probability, not as a rank.
 */
export function calibrationCurve(
  scores: number[], labels: number[], bins = 10,
): CalibrationBin[] {
  const buckets = Array.from({ length: bins }, () => ({ sum: 0, positives: 0, count: 0 }));

  for (let i = 0; i < scores.length; i += 1) {
    const index = Math.min(bins - 1, Math.floor(scores[i]! * bins));
    const bucket = buckets[index]!;
    bucket.sum += scores[i]!;
    bucket.positives += labels[i]!;
    bucket.count += 1;
  }

  return buckets
    .map((b) => ({
      predicted: b.count === 0 ? 0 : b.sum / b.count,
      observed: b.count === 0 ? 0 : b.positives / b.count,
      count: b.count,
    }))
    .filter((b) => b.count > 0);
}

/**
 * Deterministic stratified k-fold assignment.
 *
 * Stratified because displacement is the minority class: a plain split can put
 * every positive in one fold and leave the others with no positives at all,
 * which makes AUC undefined there. Deterministic so a reported score can be
 * reproduced rather than re-rolled.
 */
export function stratifiedFolds(labels: number[], k: number): number[] {
  const assignment = new Array<number>(labels.length).fill(0);
  let posCursor = 0;
  let negCursor = 0;

  for (let i = 0; i < labels.length; i += 1) {
    if (labels[i] === 1) {
      assignment[i] = posCursor % k;
      posCursor += 1;
    } else {
      assignment[i] = negCursor % k;
      negCursor += 1;
    }
  }
  return assignment;
}

/**
 * Stratified folds that keep a group together.
 *
 * One worker can appear in several outcome rows — one per arrival they lived
 * through. Splitting those rows across folds lets the model see the same person
 * in training and in test, which inflates every metric and is invisible unless
 * you look for it. Groups are assigned whole, largest first, to whichever fold
 * currently holds the fewest positives.
 */
export function groupedStratifiedFolds(
  labels: number[], groups: string[], k: number,
): number[] {
  const byGroup = new Map<string, number[]>();
  groups.forEach((g, i) => {
    const bucket = byGroup.get(g);
    if (bucket) bucket.push(i);
    else byGroup.set(g, [i]);
  });

  const ordered = [...byGroup.entries()]
    .map(([group, indices]) => ({
      group,
      indices,
      positives: indices.reduce((n, i) => n + labels[i]!, 0),
    }))
    .sort((a, b) => b.positives - a.positives || b.indices.length - a.indices.length
      || a.group.localeCompare(b.group));

  const foldPositives = new Array<number>(k).fill(0);
  const foldSizes = new Array<number>(k).fill(0);
  const assignment = new Array<number>(labels.length).fill(0);

  // Balance positives AND total size together.
  //
  // Balancing positives alone lets one fold absorb every large negative-only
  // group: folds then train at very different class rates, their scores land on
  // different scales, and pooling those out-of-fold predictions produces an AUC
  // that reflects the scale mismatch rather than the model. Each fold's cost is
  // normalised by its target so the two terms are comparable.
  const targetPositives = Math.max(1, labels.reduce((n, y) => n + y, 0) / k);
  const targetSize = Math.max(1, labels.length / k);

  for (const entry of ordered) {
    let target = 0;
    let bestCost = Infinity;
    for (let f = 0; f < k; f += 1) {
      const cost = foldPositives[f]! / targetPositives + foldSizes[f]! / targetSize;
      if (cost < bestCost) { bestCost = cost; target = f; }
    }
    for (const i of entry.indices) assignment[i] = target;
    foldPositives[target]! += entry.positives;
    foldSizes[target]! += entry.indices.length;
  }

  return assignment;
}
