---
title: API reference
tags: [reference, api]
---

# API reference

Base URL `/api`. JSON in, JSON out. **No authentication in v1.**

## Reference data

| Method | Path | |
| --- | --- | --- |
| `GET` | `/health` | Engine version, rules hash, database status |
| `GET` | `/roles` | The 16 canonical roles with their synonyms |
| `GET` | `/operations` | The 32 operations with automatability scores |
| `GET` | `/risk-rules` | The knowledge base, with rationale and provenance |
| `GET` | `/training-programs` | The training catalogue |
| `GET` | `/machine-types` | The machine catalogue, with per-role impact and sources |

## Factories

| Method | Path | |
| --- | --- | --- |
| `GET` | `/factories` | All factories, with roster size |
| `POST` | `/factories` | Create. `{ name, location?, productMix? }` |
| `DELETE` | `/factories/:id` | Delete, cascading |

## Inputs

| Method | Path | |
| --- | --- | --- |
| `GET` | `/factories/:id/headcounts` | The role roster |
| `PUT` | `/factories/:id/headcounts` | Set one role's headcount |
| `DELETE` | `/factories/:id/headcounts/:roleId` | Remove a role |
| `GET` | `/factories/:id/machinery-plans` | The machine roadmap |
| `POST` | `/factories/:id/machinery-plans` | Add an arrival |
| `DELETE` | `/factories/:id/machinery-plans/:planId` | Remove an arrival |

## Import

| Method | Path | |
| --- | --- | --- |
| `GET` | `/import/columns` | Accepted columns per import kind |
| `POST` | `/factories/:id/import/:kind` | `roster` · `machinery` · `workers` · `outcomes` |
| `GET` | `/factories/:id/imports` | Import history with line-level errors |
| `GET` | `/datasets` | CSV sets on the server, importable without upload |
| `POST` | `/factories/:id/datasets/:name/import` | Import one server-side dataset |

> An import returns `200` if any row landed and `422` if none did — **the body
> is identical either way**, because the row-level report is the useful
> response. See [[CSV import]].

## Analysis

| Method | Path | |
| --- | --- | --- |
| `POST` | `/factories/:id/run-analysis` | Run the engine, persist a run. `{ asOfDate? }` |
| `GET` | `/factories/:id/plan` | Latest plan: findings, calendar, totals |
| `GET` | `/factories/:id/runs` | Run history |
| `GET` | `/runs/:runId/plan` | Re-derive a specific historical run |
| `GET` | `/factories/:id/report` | The buyer-facing transition report |

There is deliberately **no endpoint returning a bare ranked risk list**. See
[[Ethical constraints]].

## Model

| Method | Path | |
| --- | --- | --- |
| `GET` | `/factories/:id/model?target=` | Status, metrics, diagnostics |
| `POST` | `/factories/:id/model/train` | Fit. `{ target? }` |
| `GET` | `/factories/:id/outcomes/summary` | Recorded outcomes by role |

`target` is `displacement` (default) or `retraining_success`.

> Training **always returns a status**. A refusal to train is a legitimate
> outcome, not an error: too few rows means the honest answer is "keep using
> the rules".

## Role names are resolved, not matched

Anywhere a role is accepted, send either `roleId` or a name. Names go through
the synonym table — all of these reach the same role:

```
"Cutting Machine Operator"   "Cutting Machine Operators"
"cutting operator"           "  CUTTING  MACHINE  OPERATORS  "
```

## Examples

Add an arrival — naming a `machineType` is what lets displacement be derived:

```bash
curl -X POST http://localhost:7420/api/factories/1/machinery-plans \
  -H 'Content-Type: application/json' \
  -d '{
    "machineName": "Automated laser cutter",
    "machineType": "automated-laser-cutter",
    "affectedRole": "Cutting Machine Operator",
    "arrivalDate": "2027-12-01",
    "units": 2
  }'
```

Omit it and you must supply `headcountDisplacedPerUnit` yourself — the request
is rejected if neither is present, rather than silently defaulting to a guess.

Run against a fixed date, so the result is reproducible:

```bash
curl -X POST http://localhost:7420/api/factories/1/run-analysis \
  -H 'Content-Type: application/json' \
  -d '{"asOfDate": "2026-09-04"}'
```

## Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "role_not_resolved",
    "message": "No role matches \"Astronaut\". Send a roleId, or use a name from GET /api/roles.",
    "details": { "role": "Astronaut" }
  }
}
```

Codes: `validation_failed` · `not_found` · `role_not_resolved` ·
`no_training_program` · `conflict` · `internal_error`

---

Related: [[Request lifecycle]] · [[CSV import]] · [[ML overview]]
