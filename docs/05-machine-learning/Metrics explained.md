---
title: Metrics explained
tags: [ml, reference]
---

# Metrics explained

All figures are **out-of-fold**, never training-set. A model scored on the rows
it was fitted to reports its memory, not its skill.

## Why accuracy alone is close to useless

If 85% of workers are retained, a model that predicts "retained" for everyone
scores **85% accuracy** and has learned nothing. That is why four other numbers
are reported beside it.

## The measures

| Metric | Reads | Answers |
| --- | --- | --- |
| **AUC** | 0.5 = random, 1.0 = perfect | Would a randomly chosen displaced worker score above a randomly chosen retained one? |
| **Brier** | lower is better | Are the probabilities *calibrated*, not just correctly ordered? |
| **Precision** | higher is better | Of those flagged, how many were actually displaced? |
| **Recall** | higher is better | **Of those displaced, how many did we find?** |
| **F1** | harmonic mean | One number when precision and recall trade off |

Recall is the one that says whether anyone at risk was actually found.

## AUC, carefully

Computed as a rank statistic, with **ties sharing the averaged rank** — so a
model that outputs one constant for every row scores 0.5, not accidentally 1.0.

Returns **null**, not zero, when only one class is present. Undefined is not
the same as bad.

## The confidence interval

A single AUC from 60 rows and one from 6,000 look identical on a dashboard and
mean very different things. A bootstrap 95% interval is reported alongside, and
its lower bound is what [[The baseline gate]] tests.

Resamples are drawn at a capped size, so the interval is slightly
**conservative** — the right direction for a figure that gates a model into
production.

## Calibration

Ranking and calibration are different properties. A model can order workers
perfectly and still be systematically overconfident, which matters here because
the number is read as a probability.

The curve bins predictions and shows observed rate against predicted:

| predicted | observed | gap |
| --- | --- | --- |
| 0.25 | 0.11 | −0.14 |
| 0.45 | 0.23 | −0.22 |
| 0.74 | 0.70 | −0.04 |

A systematic negative gap in the middle bands is the expected signature of
class balancing, which shifts the intercept to find the minority class. Worth
knowing when reading a score as a probability rather than a rank.

## Permutation importance

Shuffle one feature, measure how far AUC falls.

More honest than reading coefficients: it reports what the model **actually
relies on**, works identically for both algorithms, and a feature the model
ignores scores zero however large its coefficient looks.

## Learning curve

Cross-validated AUC at increasing sample sizes.

> Still climbing at the right-hand end → recording more outcomes will keep
> improving the model.
> Flat → the limit is which features you collect, not how many rows.

---

Related: [[Training pipeline]] · [[The baseline gate]] · [[Features]]
