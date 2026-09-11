import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fit, predict, featureInfluence, sigmoid } from '../src/ml/logistic.ts';
import { auc, brier, accuracy, stratifiedFolds } from '../src/ml/metrics.ts';
import {
  train, scoreModel, MIN_SAMPLES, MIN_PER_CLASS, type TrainingData,
} from '../src/ml/train.ts';
import { fitTrees, predictTrees, treeImportance } from '../src/ml/trees.ts';
import {
  aucConfidenceInterval, calibrationCurve, precisionRecall, groupedStratifiedFolds,
} from '../src/ml/metrics.ts';
import { toFeatureRow, FEATURE_NAMES } from '../src/ml/features.ts';

/** Deterministic pseudo-random source, so a failure is reproducible. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * A separable problem with a known answer.
 *
 * The label depends on feature 0 and not at all on feature 1, so a model that
 * has genuinely learned should weight the first heavily and the second near
 * zero — which is a far stronger check than "accuracy looked high".
 */
function separableDataset(n: number, seed = 7): TrainingData {
  const rand = rng(seed);
  const x: number[][] = [];
  const y: number[] = [];
  const baseline: number[] = [];
  const groups: string[] = [];

  for (let i = 0; i < n; i += 1) {
    const signal = rand() * 10 - 5;
    const noise = rand() * 10 - 5;
    x.push([signal, noise]);
    y.push(signal > 0 ? 1 : 0);
    baseline.push(0.5);
    groups.push(`W-${i}`);
  }
  return { x, y, baseline, groups, featureNames: ['signal', 'noise'] };
}

test('sigmoid is stable at both extremes', () => {
  assert.equal(sigmoid(0), 0.5);
  assert.ok(sigmoid(800) > 0.999 && Number.isFinite(sigmoid(800)));
  assert.ok(sigmoid(-800) < 0.001 && Number.isFinite(sigmoid(-800)));
});

test('the model learns a separable boundary', () => {
  const data = separableDataset(300);
  const model = fit(data, { iterations: 3000 });
  const scores = data.x.map((row) => predict(model, row));

  const measured = auc(scores, data.y);
  assert.ok(measured !== null && measured > 0.95, `expected AUC > 0.95, got ${measured}`);
});

test('the model puts its weight on the predictive feature, not the noise', () => {
  const model = fit(separableDataset(300), { iterations: 3000 });
  const influence = featureInfluence(model);

  assert.equal(influence[0]!.feature, 'signal');
  assert.ok(
    Math.abs(influence[0]!.weight) > 5 * Math.abs(influence[1]!.weight),
    'the predictive feature should dominate the irrelevant one',
  );
});

test('predictions are probabilities', () => {
  const data = separableDataset(120);
  const model = fit(data);
  for (const row of data.x) {
    const p = predict(model, row);
    assert.ok(p >= 0 && p <= 1, `probability out of range: ${p}`);
  }
});

test('a constant-variance feature does not divide by zero', () => {
  const model = fit({
    x: [[1, 5], [1, 7], [1, 2], [1, 9]],
    y: [0, 1, 0, 1],
    featureNames: ['constant', 'varies'],
  });
  assert.ok(Number.isFinite(model.weights[0]!));
  assert.ok(Number.isFinite(model.weights[1]!));
});

test('AUC is 0.5 for a constant score and undefined for one class', () => {
  assert.equal(auc([0.5, 0.5, 0.5, 0.5], [1, 0, 1, 0]), 0.5);
  assert.equal(auc([0.9, 0.1], [1, 1]), null, 'undefined, not an accidental 1.0');
});

test('AUC is 1 for a perfect ranking and 0 for a reversed one', () => {
  assert.equal(auc([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1]), 0.75);
  assert.equal(auc([0.9, 0.8, 0.2, 0.1], [1, 1, 0, 0]), 1);
  assert.equal(auc([0.1, 0.2, 0.8, 0.9], [1, 1, 0, 0]), 0);
});

test('Brier and accuracy behave at the extremes', () => {
  assert.equal(brier([1, 0], [1, 0]), 0);
  assert.equal(brier([0, 1], [1, 0]), 1);
  assert.equal(accuracy([0.9, 0.1], [1, 0]), 1);
});

test('stratified folds spread the minority class across every fold', () => {
  // 10 positives, 40 negatives.
  const labels = [...Array(10).fill(1), ...Array(40).fill(0)];
  const folds = stratifiedFolds(labels, 5);

  for (let k = 0; k < 5; k += 1) {
    const positives = labels.filter((y, i) => folds[i] === k && y === 1).length;
    assert.ok(positives > 0, `fold ${k} has no positives, so its AUC would be undefined`);
  }
});

/** The honesty gate: too little data must produce a refusal, not a model. */
test('training refuses rather than fitting on too few rows', () => {
  const small = separableDataset(MIN_SAMPLES - 1);
  const result = train(small);

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.model, undefined);
  assert.match(result.reason ?? '', /at least/);
});

test('training refuses when one outcome is too rare', () => {
  const data = separableDataset(100);
  // Leave only a handful of positives.
  data.y = data.y.map((_, i) => (i < MIN_PER_CLASS - 1 ? 1 : 0));

  const result = train(data);
  assert.equal(result.status, 'insufficient_data');
  assert.match(result.reason ?? '', /of each result/);
});

test('training reports cross-validated metrics and a baseline comparison', () => {
  const result = train(separableDataset(240));

  assert.equal(result.status, 'trained');
  assert.ok(result.metrics);
  assert.ok(result.metrics!.auc !== null && result.metrics!.auc > 0.9);
  // Baseline here is a constant 0.5, which by construction is AUC 0.5.
  assert.equal(result.baselineAuc, 0.5);
  assert.equal(result.beatsBaseline, true);
});

/**
 * The gate has to bite. A dataset with no learnable signal must not be
 * promoted over the rules just because a model was produced.
 */
test('feature rows have one value per declared feature name', () => {
  const row = toFeatureRow({
    tenureMonths: 36, operationsKnown: 3, skillGrade: 'skilled',
    operationAutomatability: 80, primaryOperationShare: 0.5,
    timeToCompetencyWeeks: 4, priorTrainings: 2, priorTrainingsPassed: 2,
    literacyLevel: 'functional', digitalComfort: 'basic',
    machineDisplacementPerUnit: 7, roleBaseRisk: 74, trainedBeforeArrival: true,
  });
  assert.equal(row.length, FEATURE_NAMES.length);
  assert.equal(row[0], 3, 'tenure is expressed in years');
  // The interaction term: automatability only counts for the share of time
  // actually spent on that operation.
  assert.equal(row[5], 0.4, '0.8 automatability x 0.5 share');
});

test('missing values fall back to neutral, not to zero', () => {
  const row = toFeatureRow({
    tenureMonths: null, operationsKnown: null, skillGrade: 'unknown',
    operationAutomatability: null, primaryOperationShare: null,
    timeToCompetencyWeeks: null, priorTrainings: null, priorTrainingsPassed: null,
    literacyLevel: 'unknown', digitalComfort: 'unknown',
    machineDisplacementPerUnit: null, roleBaseRisk: null, trainedBeforeArrival: false,
  });
  // Zero tenure is a real value; "unknown" must not be encoded as a new hire.
  assert.equal(row[0], 2);
  assert.equal(row[3], 0.5, 'neutral automatability');
  assert.equal(row[7], 0.5, 'an untrained worker is not a 0% pass rate');
});


// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

test('class balancing finds the minority class where an unbalanced fit will not', () => {
  const rand = rng(21);
  const x: number[][] = [];
  const y: number[] = [];
  // 5% positives, which is roughly what a real displacement rate looks like.
  for (let i = 0; i < 400; i += 1) {
    const positive = i % 20 === 0;
    x.push([positive ? 3 + rand() : rand(), rand()]);
    y.push(positive ? 1 : 0);
  }

  const balanced = fit({ x, y, featureNames: ['signal', 'noise'] }, { balanceClasses: true });
  const scores = x.map((row) => predict(balanced, row));

  // Recall is the number that says whether anyone at risk was actually found.
  const { recall } = precisionRecall(scores, y);
  assert.ok(recall > 0.8, `expected the rare class to be found, recall was ${recall}`);
});

test('the tree ensemble learns a threshold a linear model has to approximate', () => {
  const rand = rng(5);
  const x: number[][] = [];
  const y: number[] = [];
  // Non-monotone: the middle band is positive, both tails are negative.
  for (let i = 0; i < 400; i += 1) {
    const v = rand() * 10;
    x.push([v, rand()]);
    y.push(v > 4 && v < 6 ? 1 : 0);
  }

  const trees = fitTrees(x, y, ['v', 'noise']);
  const treeAuc = auc(x.map((row) => predictTrees(trees, row)), y);

  const linear = fit({ x, y, featureNames: ['v', 'noise'] });
  const linearAuc = auc(x.map((row) => predict(linear, row)), y);

  assert.ok(treeAuc !== null && linearAuc !== null);
  assert.ok(treeAuc > linearAuc + 0.2, `trees ${treeAuc} should clearly beat linear ${linearAuc}`);
});

test('tree importance points at the feature that carries the signal', () => {
  const rand = rng(9);
  const x: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < 300; i += 1) {
    const v = rand() * 10;
    x.push([rand() * 10, v]);
    y.push(v > 5 ? 1 : 0);
  }

  const importance = treeImportance(fitTrees(x, y, ['noise', 'signal']));
  assert.equal(importance[0]!.feature, 'signal');
});

test('the AUC confidence interval is wider on less data', () => {
  const small = separableDataset(60, 3);
  const large = separableDataset(600, 3);

  const narrow = aucConfidenceInterval(large.x.map((r) => (r[0]! > 0 ? 0.9 : 0.1)), large.y);
  const wide = aucConfidenceInterval(small.x.map((r) => (r[0]! > 0 ? 0.9 : 0.1)), small.y);

  assert.ok(narrow && wide);
  assert.ok((wide.high - wide.low) >= (narrow.high - narrow.low),
    'fewer rows must not produce a tighter interval');
});

test('a calibrated score reports observed rates close to predicted', () => {
  const scores: number[] = [];
  const labels: number[] = [];
  const rand = rng(31);
  for (let i = 0; i < 2000; i += 1) {
    const p = rand();
    scores.push(p);
    labels.push(rand() < p ? 1 : 0);
  }

  for (const bin of calibrationCurve(scores, labels)) {
    if (bin.count < 50) continue;
    assert.ok(Math.abs(bin.predicted - bin.observed) < 0.1,
      `bin at ${bin.predicted.toFixed(2)} observed ${bin.observed.toFixed(2)}`);
  }
});

/**
 * The leakage guard. One worker appears in several outcome rows, and splitting
 * those across folds lets the model see the same person on both sides.
 */
test('grouped folds keep every row of one worker on the same side', () => {
  const labels: number[] = [];
  const groups: string[] = [];
  for (let w = 0; w < 40; w += 1) {
    for (let r = 0; r < 3; r += 1) {
      labels.push(w % 4 === 0 ? 1 : 0);
      groups.push(`W-${w}`);
    }
  }

  const folds = groupedStratifiedFolds(labels, groups, 5);
  const foldByGroup = new Map<string, number>();
  groups.forEach((g, i) => {
    const seen = foldByGroup.get(g);
    if (seen === undefined) foldByGroup.set(g, folds[i]!);
    else assert.equal(folds[i], seen, `${g} was split across folds`);
  });

  // And the minority class still reaches every fold.
  for (let k = 0; k < 5; k += 1) {
    assert.ok(labels.some((y, i) => folds[i] === k && y === 1), `fold ${k} has no positives`);
  }
});

test('training reports candidates, calibration, importance and a learning curve', () => {
  const result = train(separableDataset(300));

  assert.equal(result.status, 'trained');
  assert.ok(result.candidates!.length >= 4, 'several candidates are compared');
  assert.ok(result.calibration!.length > 0);
  assert.ok(result.permutationImportance!.length > 0);
  assert.ok(result.learningCurve!.length > 0);
  assert.ok(result.aucCi !== null);

  // Permutation importance must name the feature the labels actually depend on.
  assert.equal(result.permutationImportance![0]!.feature, 'signal');
});

test('the winning model is the one that actually scores best', () => {
  const result = train(separableDataset(300));
  const best = result.candidates!.slice().sort((a, b) => (b.auc ?? 0) - (a.auc ?? 0))[0]!;
  assert.equal(result.algorithm, best.algorithm);
});

/** Noise must not be promoted over the rules, however it is fitted. */
test('a model inside the noise does not displace the rule engine', () => {
  const rand = rng(77);
  const x: number[][] = [];
  const y: number[] = [];
  const baseline: number[] = [];
  const groups: string[] = [];
  for (let i = 0; i < 300; i += 1) {
    x.push([rand(), rand()]);
    const label = i % 2;
    y.push(label);
    baseline.push(label === 1 ? 0.85 : 0.15);
    groups.push(`W-${i}`);
  }

  const result = train({ x, y, baseline, groups, featureNames: ['a', 'b'] });
  assert.equal(result.beatsBaseline, false);
});

test('a scored model returns a probability for both algorithms', () => {
  const data = separableDataset(200);
  const result = train(data);
  const p = scoreModel(result.model!, data.x[0]!);
  assert.ok(p >= 0 && p <= 1);
});


/**
 * The bug this pins.
 *
 * Balancing positives alone let one fold absorb every large negative-only
 * group. Folds then trained at very different class rates, their scores landed
 * on different scales, and the pooled out-of-fold AUC came out at 0.40 — below
 * random — while every individual fold scored 0.65. The failure is invisible
 * unless fold composition is checked directly.
 */
test('grouped folds balance size as well as positives', () => {
  const labels: number[] = [];
  const groups: string[] = [];

  // A handful of small groups carrying every positive...
  for (let w = 0; w < 40; w += 1) {
    labels.push(1);
    groups.push(`P-${w}`);
  }
  // ...and a few very large negative-only groups.
  for (let w = 0; w < 8; w += 1) {
    for (let r = 0; r < 60; r += 1) {
      labels.push(0);
      groups.push(`N-${w}`);
    }
  }

  const k = 5;
  const folds = groupedStratifiedFolds(labels, groups, k);

  const sizes = new Array(k).fill(0);
  const positives = new Array(k).fill(0);
  folds.forEach((f, i) => { sizes[f] += 1; positives[f] += labels[i]!; });

  const expectedSize = labels.length / k;
  for (let f = 0; f < k; f += 1) {
    assert.ok(positives[f] > 0, `fold ${f} has no positives`);
    // No fold may be more than twice its fair share, which is what produced
    // the incomparable score scales.
    assert.ok(sizes[f] <= expectedSize * 2,
      `fold ${f} holds ${sizes[f]} rows against a fair share of ${expectedSize}`);
  }
});
