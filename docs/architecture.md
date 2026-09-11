# Architecture

## Shape

```
packages/
  shared/   Domain and API types. The contract both sides compile against.
  server/   Express + SQLite. The engine, the API, the knowledge base.
  web/      Vite + React. Marketing site at /, product at /app.
```

The web package is split the same way:

```
src/site/     The marketing surface — one route, no data dependencies
src/app/      The application shell: sidebar, factory switcher, run action
src/pages/    Overview, Plan, Setup, Knowledge base, Report
src/copy/     All interface strings and the number/date/currency formatters
```

A change to a shared type breaks the build on both sides rather than showing up
as a blank panel in the browser.

## Why these choices

**`node:sqlite`, not `better-sqlite3`.** SQLite ships inside Node 22.6+. No
native compilation, no build toolchain, no install step that fails on a machine
without Xcode. For a single-factory v1 the database is a file.

**Native TypeScript, no build step on the server.** Node 22.6+ strips types
directly, so `node src/index.ts` runs. `tsc` is used for checking only
(`npm run typecheck`), never for emitting.

**Express, not something newer.** Six endpoints. Every developer who will touch
this already knows it.

**No ORM.** The queries are hand-written and readable, and the join in
`repositories/analysis.ts` is the load-bearing one — it should be visible.

## The layers

```
routes/        HTTP. Validation, status codes, error shapes. No logic.
services/      Orchestration. Reads the clock, opens transactions.
engine/        Pure functions. No database, no clock, no randomness.
repositories/  SQL. Row mapping and nothing else.
db/            Schema, migrations, seed data.
```

The engine is pure on purpose: it is what makes the golden test possible, and it
is the piece most likely to change as the knowledge base grows.

## Data flow

```
role headcounts  ─┐
machine roadmap  ─┼─→ analyze()  ─→ findings ─→ buildSchedule() ─→ calendar
risk rules       ─┤                                            └─→ buildReport()
training catalog ─┘
```

`analyze()` never reads a clock. `asOfDate` is passed in, which is what makes a
run reproducible and lets the golden test pin a date.

## The engine, in one paragraph

For each machine arrival, find the affected role's headcount, its highest-scoring
risk rule, and its shortest training programme. Cap workers affected at the
roster. Divide by monthly seat capacity to get cohorts. Work backwards from the
arrival date — one intake month per extra cohort, plus the programme duration —
to get the date training must begin. Compare that to today for the status.

There is no machine learning, and v1 does not need any. The knowledge base is the
intelligence; the engine is arithmetic.

## The data model, in one pass

```
roles ─┬─ operations ──┬─ machine_operations ── machine_types ─┬─ machine_role_impact
       │               │                                       └─ machinery_plans
       ├─ risk_rules   │
       ├─ wage_bands   │
       ├─ training_programs
       ├─ role_headcounts ── factories
       └─ workers  (phase 4, unread by the engine)

analysis_runs ── findings
```

`operations` is the join that matters: machines replace *operations*, not roles,
and a role loses headcount in proportion to how much of its work is absorbed. It
is also the field that would make worker-level scoring meaningful — within
"sewing operator", a straight-seam worker is far more exposed than one doing
complex assembly, and only the operation says so.

## Known limits of v1

**Risk is role-level.** Every worker in a role scores the same, because the rules
key on role alone. `workers.tenure_months` is collected and not yet read.
Worker-level differentiation is phase 4 and is the main thing that would make two
sewing operators score differently.

**Seat capacities are defaults.** Capacity is the binding constraint in every
schedule the engine produces, so a wrong number in `training_programs` changes
the answer. Real deployments replace these during onboarding.

**Single factory, no authentication.** `factory_id` is threaded through every
table, so multi-tenancy is a routing change rather than a migration. Auth is
deliberately absent from v1.

**Cohorts are sequential.** The engine assumes one intake per month per
programme. A factory running two parallel cohorts is not yet expressible.
