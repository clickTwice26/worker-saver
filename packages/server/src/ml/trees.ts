/**
 * Gradient-boosted decision stumps.
 *
 * A second candidate, fitted alongside the logistic model and kept only if it
 * validates better. It exists because the relationships here are not all
 * linear: a worker becomes redeployable somewhere around three or four known
 * operations rather than gradually, and a stump ensemble finds that threshold
 * where an additive model has to approximate it with a slope.
 *
 * Depth-1 trees deliberately. Deeper trees would fit interactions the sample
 * sizes here cannot support, and the ensemble stays inspectable: every member
 * is one feature and one threshold.
 */

export interface Stump {
  featureIndex: number;
  threshold: number;
  /** Added to the running log-odds when the feature is at or below threshold. */
  leftValue: number;
  rightValue: number;
}

export interface TreeModel {
  featureNames: string[];
  baseLogOdds: number;
  stumps: Stump[];
  learningRate: number;
}

export interface TreeFitOptions {
  rounds?: number;
  learningRate?: number;
  /** Candidate split points examined per feature. */
  bins?: number;
  /** A split must leave at least this many rows on each side. */
  minChildWeight?: number;
}

const DEFAULTS = { rounds: 120, learningRate: 0.1, bins: 12, minChildWeight: 8 } as const;

function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

/** Evenly spaced quantile thresholds, so splits follow the data's shape. */
function candidateThresholds(values: number[], bins: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const thresholds = new Set<number>();
  for (let b = 1; b < bins; b += 1) {
    const idx = Math.floor((b / bins) * (sorted.length - 1));
    thresholds.add(sorted[idx]!);
  }
  return [...thresholds];
}

export function fitTrees(
  x: number[][], y: number[], featureNames: string[], options: TreeFitOptions = {},
): TreeModel {
  const { rounds, learningRate, bins, minChildWeight } = { ...DEFAULTS, ...options };
  const rows = x.length;
  const cols = x[0]?.length ?? 0;
  if (rows === 0 || cols === 0) throw new Error('fitTrees: empty dataset');

  const positives = y.reduce((n, v) => n + v, 0);
  const rate = Math.min(Math.max(positives / rows, 1e-6), 1 - 1e-6);
  const baseLogOdds = Math.log(rate / (1 - rate));

  const scores = new Array<number>(rows).fill(baseLogOdds);
  const stumps: Stump[] = [];

  const thresholdsByFeature = Array.from({ length: cols }, (_, j) =>
    candidateThresholds(x.map((row) => row[j]!), bins));

  for (let round = 0; round < rounds; round += 1) {
    // Newton step on the logistic loss: gradient and hessian per row.
    const grad = new Array<number>(rows);
    const hess = new Array<number>(rows);
    for (let i = 0; i < rows; i += 1) {
      const p = sigmoid(scores[i]!);
      grad[i] = p - y[i]!;
      hess[i] = Math.max(p * (1 - p), 1e-6);
    }

    let best: { gain: number; stump: Stump } | null = null;

    for (let j = 0; j < cols; j += 1) {
      for (const threshold of thresholdsByFeature[j]!) {
        let gl = 0; let hl = 0; let nl = 0;
        let gr = 0; let hr = 0; let nr = 0;

        for (let i = 0; i < rows; i += 1) {
          if (x[i]![j]! <= threshold) { gl += grad[i]!; hl += hess[i]!; nl += 1; }
          else { gr += grad[i]!; hr += hess[i]!; nr += 1; }
        }
        // A split that isolates a handful of rows is memorising them.
        if (nl < minChildWeight || nr < minChildWeight) continue;

        const gain = (gl * gl) / hl + (gr * gr) / hr;
        if (!best || gain > best.gain) {
          best = {
            gain,
            stump: { featureIndex: j, threshold, leftValue: -gl / hl, rightValue: -gr / hr },
          };
        }
      }
    }

    // No admissible split left; further rounds would add nothing.
    if (!best) break;

    stumps.push(best.stump);
    for (let i = 0; i < rows; i += 1) {
      const s = best.stump;
      scores[i]! += learningRate * (x[i]![s.featureIndex]! <= s.threshold ? s.leftValue : s.rightValue);
    }
  }

  return { featureNames, baseLogOdds, stumps, learningRate };
}

export function predictTrees(model: TreeModel, features: number[]): number {
  let z = model.baseLogOdds;
  for (const stump of model.stumps) {
    z += model.learningRate
      * (features[stump.featureIndex]! <= stump.threshold ? stump.leftValue : stump.rightValue);
  }
  return sigmoid(z);
}

/** Total split gain per feature, normalised. Which features the ensemble used. */
export function treeImportance(model: TreeModel): Array<{ feature: string; weight: number }> {
  const totals = new Array<number>(model.featureNames.length).fill(0);
  for (const stump of model.stumps) {
    totals[stump.featureIndex]! += Math.abs(stump.leftValue - stump.rightValue);
  }
  const sum = totals.reduce((a, b) => a + b, 0) || 1;
  return model.featureNames
    .map((feature, j) => ({ feature, weight: totals[j]! / sum }))
    .sort((a, b) => b.weight - a.weight);
}
