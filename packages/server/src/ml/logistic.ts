/**
 * Regularised logistic regression, fitted by gradient descent.
 *
 * Written out rather than pulled from a library because the whole model is
 * ~60 lines of arithmetic, and a model whose coefficients decide how a factory
 * treats its workforce should be readable by the people arguing about it.
 *
 * Features are standardised before fitting. Without it, `tenure_months` (0-400)
 * and a 0/1 flag land on wildly different gradient scales and the larger
 * feature dominates the fit for reasons that have nothing to do with the data.
 */

export interface Dataset {
  /** Row-major feature matrix. */
  x: number[][];
  /** Binary labels, 1 = the positive class. */
  y: number[];
  featureNames: string[];
}

export interface LogisticModel {
  featureNames: string[];
  weights: number[];
  intercept: number;
  means: number[];
  stds: number[];
}

export interface FitOptions {
  /** L2 penalty. Guards against a confident fit on very few examples. */
  l2?: number;
  learningRate?: number;
  /** Upper bound; fitting stops early once the gradient settles. */
  iterations?: number;
  /**
   * Reweight the minority class to its inverse frequency.
   *
   * Displacement is the rare outcome. Without this the fit minimises loss by
   * predicting "retained" almost everywhere, which scores well on accuracy and
   * is useless for the only decision anyone makes with it.
   */
  balanceClasses?: boolean;
  /** Gradient-norm threshold for early stopping. */
  tolerance?: number;
}

const DEFAULTS = {
  l2: 1.0, learningRate: 0.3, iterations: 4000, balanceClasses: true, tolerance: 1e-6,
} as const;

export function sigmoid(z: number): number {
  // Branching keeps exp() away from overflow at either extreme.
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

/** Column means and standard deviations. A zero-variance column gets std 1. */
function standardise(x: number[][]): { means: number[]; stds: number[] } {
  const rows = x.length;
  const cols = x[0]?.length ?? 0;
  const means = new Array<number>(cols).fill(0);
  const stds = new Array<number>(cols).fill(0);

  for (const row of x) for (let j = 0; j < cols; j += 1) means[j]! += row[j]! / rows;

  for (const row of x) {
    for (let j = 0; j < cols; j += 1) {
      const d = row[j]! - means[j]!;
      stds[j]! += (d * d) / rows;
    }
  }
  for (let j = 0; j < cols; j += 1) {
    const sd = Math.sqrt(stds[j]!);
    // A constant column carries no information; leaving std at 1 makes it a
    // zero after centring rather than a division by zero.
    stds[j] = sd < 1e-9 ? 1 : sd;
  }
  return { means, stds };
}

function applyScaling(row: number[], means: number[], stds: number[]): number[] {
  return row.map((v, j) => (v - means[j]!) / stds[j]!);
}

export function fit(data: Dataset, options: FitOptions = {}): LogisticModel {
  const { l2, learningRate, iterations, balanceClasses, tolerance } = { ...DEFAULTS, ...options };
  const rows = data.x.length;
  const cols = data.x[0]?.length ?? 0;
  if (rows === 0 || cols === 0) throw new Error('fit: empty dataset');

  const { means, stds } = standardise(data.x);
  const scaled = data.x.map((row) => applyScaling(row, means, stds));

  // Inverse-frequency weights, normalised so the effective sample size — and
  // therefore the meaning of the L2 term — stays comparable across datasets.
  const positives = data.y.reduce((n, v) => n + v, 0);
  const negatives = rows - positives;
  let wPos = 1;
  let wNeg = 1;
  if (balanceClasses && positives > 0 && negatives > 0) {
    wPos = rows / (2 * positives);
    wNeg = rows / (2 * negatives);
  }
  const sampleWeight = data.y.map((label) => (label === 1 ? wPos : wNeg));
  const weightTotal = sampleWeight.reduce((a, b) => a + b, 0);

  const weights = new Array<number>(cols).fill(0);
  let intercept = 0;

  for (let step = 0; step < iterations; step += 1) {
    const gradW = new Array<number>(cols).fill(0);
    let gradB = 0;

    for (let i = 0; i < rows; i += 1) {
      const row = scaled[i]!;
      let z = intercept;
      for (let j = 0; j < cols; j += 1) z += weights[j]! * row[j]!;
      const error = (sigmoid(z) - data.y[i]!) * sampleWeight[i]!;

      for (let j = 0; j < cols; j += 1) gradW[j]! += (error * row[j]!) / weightTotal;
      gradB += error / weightTotal;
    }

    // The intercept is deliberately left unpenalised: shrinking it biases the
    // model's base rate away from the observed one.
    let gradNorm = gradB * gradB;
    for (let j = 0; j < cols; j += 1) {
      const g = gradW[j]! + (l2 * weights[j]!) / rows;
      gradNorm += g * g;
      weights[j]! -= learningRate * g;
    }
    intercept -= learningRate * gradB;

    // Converged. Running the remaining iterations changes nothing but time.
    if (Math.sqrt(gradNorm) < tolerance) break;
  }

  return { featureNames: data.featureNames, weights, intercept, means, stds };
}

/** Probability of the positive class, 0-1. */
export function predict(model: LogisticModel, features: number[]): number {
  const scaled = applyScaling(features, model.means, model.stds);
  let z = model.intercept;
  for (let j = 0; j < model.weights.length; j += 1) z += model.weights[j]! * scaled[j]!;
  return sigmoid(z);
}

/**
 * Standardised coefficients, largest absolute value first.
 *
 * Comparable across features precisely because the inputs were standardised —
 * on raw scales the magnitudes would say more about units than about influence.
 */
export function featureInfluence(model: LogisticModel): Array<{ feature: string; weight: number }> {
  return model.featureNames
    .map((feature, j) => ({ feature, weight: model.weights[j]! }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}
