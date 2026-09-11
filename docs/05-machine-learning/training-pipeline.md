[← Documentation index](../README.md)

# Training pipeline

```mermaid
flowchart TD
    O[("outcomes table")] --> BD["buildDataset<br/>features + labels + baseline + groups"]
    BD --> SZ{"rows > 25,000?"}
    SZ -- yes --> SUB["Subsample by whole worker group"]
    SZ -- no --> FLOOR
    SUB --> FLOOR{"40+ rows and<br/>8+ of each result?"}

    FLOOR -- no --> REFUSE["insufficient_data<br/>rules keep scoring"]
    FLOOR -- yes --> FOLDS["groupedStratifiedFolds<br/>balance positives AND size"]

    FOLDS --> CAND["5 candidates"]
    CAND --> C1["logistic L2 = 0.1"]
    CAND --> C2["logistic L2 = 1"]
    CAND --> C3["logistic L2 = 10"]
    CAND --> C4["stumps, 60 rounds"]
    CAND --> C5["stumps, 140 rounds"]

    C1 --> CV["5-fold cross-validation<br/>out-of-fold predictions only"]
    C2 --> CV
    C3 --> CV
    C4 --> CV
    C5 --> CV

    CV --> PICK["Select on AUC,<br/>Brier breaks ties"]
    PICK --> GATE{"Beats the rule baseline,<br/>CI lower bound clear?"}

    GATE -- yes --> ACT["Fit on all rows, ACTIVATE"]
    GATE -- no --> STORE["Fit, store, DO NOT activate"]

    ACT --> DIAG["Diagnostics"]
    STORE --> DIAG
    DIAG --> D1["bootstrap CI"]
    DIAG --> D2["calibration curve"]
    DIAG --> D3["permutation importance"]
    DIAG --> D4["learning curve"]

    style REFUSE fill:#e9ecef,stroke:#495057
    style GATE fill:#fff3cd,stroke:#856404
    style ACT fill:#e8f4ea,stroke:#2d6a4f
    style STORE fill:#f8d7da,stroke:#842029
```

## Group-aware folds

One worker appears **once per arrival they lived through**. Splitting those
rows across folds lets the model see the same person in training and in test,
inflating every metric invisibly.

Folds are assigned by whole group — and balanced on **both positives and total
size**. That second part was a real bug:

| | fold 0 | fold 1 | fold 2 | fold 3 | fold 4 |
| --- | --- | --- | --- | --- | --- |
| rows | 794 | 798 | 798 | **4411** | 797 |
| positives | 453 | 453 | 453 | 452 | 453 |

Every fold scored 0.62–0.67 individually, yet the pooled out-of-fold AUC came
out at **0.40 — below random**. Fold 3 trained at a 10% positive rate while the
others trained at 57%; their scores were not on the same scale, so pooling them
measured the mismatch rather than the model. After balancing both axes the
ensemble went **0.40 → 0.757**.

`tests/ml.test.ts` now checks fold composition directly, because the failure is
invisible from the metric alone.

## Two algorithms

| | |
| --- | --- |
| **Logistic regression, L2** | ~60 lines. Standardised inputs, class-balanced, early stopping on gradient norm. Readable by the people who will argue with it. |
| **Gradient-boosted stumps** | Depth-1 trees. Finds thresholds — you become redeployable *around* 3–4 operations, not gradually — that an additive model can only approximate with a slope. |

Class balancing matters more than it sounds. Displacement is the minority
class; without inverse-frequency weights the fit minimises loss by predicting
"retained" almost everywhere, scoring well on accuracy and being useless for
the only decision anyone makes with it.

## The sampling cap

Above **25,000 rows** the dataset is subsampled by whole worker group.

Full-batch gradient descent is O(iterations × rows × features), run per
candidate per fold. At a million rows that is tens of billions of operations
for a model whose coefficients stopped moving long before. At 25,000 rows the
standard error on AUC is about **0.006** — far tighter than any decision made
from it.

The status response reports **rows fitted against rows available**, because a
model quietly trained on a fortieth of the data would be a misleading thing to
hide.

The learning curve confirms the choice empirically: `6250→0.781  12500→0.787
18750→0.788  25001→0.789`. The remaining 970,000 rows would buy the third
decimal place.

---

Related: [The baseline gate](the-baseline-gate.md) · [Metrics explained](metrics-explained.md) · [Features](features.md)
