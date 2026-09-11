# API

Base URL `http://localhost:7420/api`. JSON in, JSON out. No authentication in v1.

## Reference

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/health` | Engine version, rules version, database status |
| GET | `/roles` | The eight canonical roles with their synonyms |
| GET | `/factories` | Factories (v1 seeds exactly one) |
| GET | `/risk-rules` | The knowledge base, with rationale and provenance |
| GET | `/training-programs` | The training catalogue |
| GET | `/machine-types` | The machine catalogue, with per-role impact and sources |
| GET | `/operations` | The operations catalogue |

## Factory inputs

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/factories/:id/headcounts` | The role roster |
| PUT | `/factories/:id/headcounts` | Set one role's headcount |
| DELETE | `/factories/:id/headcounts/:roleId` | Remove a role from the roster |
| GET | `/factories/:id/machinery-plans` | The machine roadmap |
| POST | `/factories/:id/machinery-plans` | Add an arrival |
| DELETE | `/factories/:id/machinery-plans/:planId` | Remove an arrival |

## Analysis

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/factories/:id/run-analysis` | Run the engine, persist a new run |
| GET | `/factories/:id/plan` | Latest plan: findings, calendar, totals |
| GET | `/factories/:id/runs` | Run history |
| GET | `/runs/:runId/plan` | Re-derive a specific historical run |
| GET | `/factories/:id/report` | The buyer-facing transition report |

There is deliberately no endpoint returning a bare ranked risk list. See
[ethics.md](ethics.md).

## Role names are resolved, not matched

Anywhere a role is accepted, send either `roleId` or a name. Names go through the
synonym table, so all of these reach the same role:

```
"Cutting Machine Operator"   "Cutting Machine Operators"
"cutting operator"           "cutter operator"
"  CUTTING  MACHINE  OPERATORS  "
```

This is the fix for the defect in the original specification, where seed data
used the plural, input tables used the singular, and the engine compared them
with exact string equality — so its first run returned nothing.

## Examples

Add a machine arrival:

```bash
curl -X POST http://localhost:7420/api/factories/1/machinery-plans \
  -H 'Content-Type: application/json' \
  -d '{
    "machineName": "Automated laser cutter",
    "machineType": "automated-laser-cutter",
    "affectedRole": "Cutting Machine Operator",
    "arrivalDate": "2026-12-01",
    "units": 2
  }'
```

Naming a `machineType` is what lets displacement be derived from the catalogue.
Omit it and you must supply `headcountDisplacedPerUnit` yourself — the request is
rejected if neither is present, rather than silently defaulting to a guess.

Run the analysis against a fixed date, so the result is reproducible:

```bash
curl -X POST http://localhost:7420/api/factories/1/run-analysis \
  -H 'Content-Type: application/json' \
  -d '{"asOfDate": "2026-09-04"}'
```

Read the plan:

```bash
curl http://localhost:7420/api/factories/1/plan
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

Codes: `validation_failed`, `not_found`, `role_not_resolved`,
`no_training_program`, `conflict`, `internal_error`.
