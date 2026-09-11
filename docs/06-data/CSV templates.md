---
title: CSV templates
tags: [data, reference]
---

# CSV templates

Four import formats. Headers are matched case-insensitively and ignore spaces,
hyphens and underscores, so `Worker Ref`, `worker_ref` and `worker-ref` are the
same column. Quoted fields, escaped quotes and embedded newlines are handled, so
a role like `"Finishing, Ironing & Pressing"` imports intact.

Valid rows are applied and invalid ones are reported with their line number —
one bad row does not reject the file.

| File | Required | Optional |
| --- | --- | --- |
| `roster.csv` | `role`, `workers` | — |
| `machinery.csv` | `machine_type`, `arrival_date` | `machine_name`, `role`, `units`, `displaced_per_unit` |
| `workers.csv` | `worker_ref`, `role` | `tenure_months`, `operations_known`, `skill_grade`, `operation`, `line`, `shift` |
| `outcomes.csv` | `worker_ref`, `role`, `arrival_date`, `outcome` | `machine_type`, `tenure_months`, `operations_known`, `skill_grade`, `operation`, `trained_before_arrival` |

## Notes

**`role`** accepts any name in the synonym table — singular or plural, any case.
`GET /api/roles` lists them.

**`machine_type`** is a catalogue slug from `GET /api/machine-types`. Supplying it
is what lets displacement be computed instead of estimated. `role` is optional:
it defaults to whichever role the machine hits hardest.

**`worker_ref`** is your own HR identifier. **A file containing a `name` column is
rejected** — this system stores pseudonymous references only.

**`outcome`** is `retained`, `redeployed` or `displaced`. These are the only
training labels the model ever sees, and `redeployed` counts as retained: the
worker kept a job, which is the result the product exists to produce.

Record the feature columns **as they were at the arrival date**, not as they are
today. Training on current values for a past decision leaks the future into the
past and produces a model that validates well and predicts nothing.


Ready-to-edit sample files: [`roster.csv`](../csv-templates/roster.csv) · [`machinery.csv`](../csv-templates/machinery.csv) · [`workers.csv`](../csv-templates/workers.csv) · [`outcomes.csv`](../csv-templates/outcomes.csv)

---

Related: [[CSV import]] · [[Recording outcomes]] · [[Data generator]]
