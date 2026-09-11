# ALE Insight

Predictive workforce transition planning for ready-made garment factories.

Given a factory's roster and the machines it plans to buy, the system produces a
month-by-month training schedule that gets ahead of every arrival — and a dated
report the factory can hand its buyer as evidence of a responsible transition.

**Anticipate · Lead · Evolve**

---

## Quick start

```bash
npm run setup
```

Installs dependencies, creates the SQLite database, applies migrations and loads
the **reference data**: the role taxonomy, the operations catalogue, the risk
knowledge base, the machine catalogue, the training catalogue and the wage bands.

**No factories, no rosters, no demo numbers.** Reference data is a knowledge base
that ships with the product; a roster belongs to a real customer. A fresh install
opens on "create your first factory".

```bash
npm run dev
```

| | |
| --- | --- |
| Web | http://localhost:7430 |
| API | http://localhost:7420/api |

A fresh install opens on **create your first factory**.

Both ports are overridable, and the web server deliberately refuses to start on a
different port than the one configured — the API allows exactly this origin
through CORS, so a silent slide to the next free port would break requests in a
way that looks like a bug in the app:

```bash
PORT=8420 ALE_WEB_PORT=8430 npm run dev
```

Requires **Node 22.6 or newer** — the project uses Node's built-in SQLite and
native TypeScript execution, so there is no native build step and no compiler
toolchain requirement.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | API and web dev server together |
| `npm test` | 75 tests: engine, CSV parser, ML, import pipeline, golden snapshot |
| `npm run typecheck` | Type-check all three packages |
| `npm run db:reset` | Drop, re-migrate and re-seed the database |
| `npm run build` | Production build of the frontend |

## What it does

A factory supplies two things:

1. **Headcounts by role** — a handful of rows, not one per worker.
2. **A machine roadmap** — which catalogue machines are arriving, and when.

The engine returns, for each arrival: who is exposed and why, how many workers,
which training answers it, **the date that training has to begin**, and what it
will cost. Findings are ordered by how soon training must start, not by risk
score — the question a factory is holding is *what do I start first*.

Two engines produce that score. The **rule engine** — the knowledge base plus
arithmetic — runs from the first day, with no training data required. A
**trained model** takes over per factory once that factory has recorded enough
real outcomes for it to measurably beat the rules. Every finding says which one
produced its number.

### The machine catalogue

Displacement is **computed, not asked for**. Earlier the plan carried a
`headcountDisplacedPerUnit` the user typed in — the product asking the factory
for the answer it exists to supply. Thirteen machine types now carry, with
sources: capital cost, install lead time, operators required per unit, output in
manual-worker equivalents, the operations absorbed, and the per-role effect.

That makes four things computable that were not before:

| | |
| --- | --- |
| **Posts created** | A machine needs operators and technicians. A plan reporting only displacement tells half the truth. |
| **Net workforce change** | Displaced minus created — frequently not the figure a factory expects. |
| **Payback period** | Capital cost over the *net* wage bill removed. A short payback means the purchase will happen, so the training window is the only variable in play. |
| **Retraining cost ratio** | Training bill against one year of the payroll it protects. It runs 2–5%. |

A factory that knows its own line better than the reference data can still
override the figure; the interface says which findings were derived and which
were overridden.

## Structure

```
packages/shared    Domain and API types — the contract both sides compile against
packages/server    Express + SQLite: engine, API, knowledge base, migrations, seed
packages/web       Vite + React: marketing site at /, product at /app
docs/              Architecture, API reference, design constraints
scripts/dev.mjs    Runs both dev servers under one Ctrl-C
```

## Three things worth knowing before you read the code

**Role names are resolved, not compared.** The original specification seeded risk
rules under `"Cutting Machine Operators"` while the worker and machinery tables
used `"Cutting Machine Operator"`, and matched them with exact string equality —
so its first run would have returned nothing. A canonical `roles` table with a
synonym index fixes it at the root. See `tests/roles.test.ts`.

**No risk score can exist without a recommended action.**
`findings.training_program_id` is `NOT NULL`, and the engine reports a coverage
gap rather than emitting a bare score. The same output that says *train these 40
first* would otherwise say *these 40 are most replaceable*, and this product does
not produce that document. See [docs/ethics.md](docs/ethics.md).

**Every number carries its provenance.** Risk rules, machine types and wage
bands each carry a `source_ref` and a `confidence`, shown in the interface beside
the figure. Machine rows marked `sourced` rest on published specifications —
CNC cutters reported as needing no more than two operators while doing the work
of four to ten; one worker tending six automated sewing units at four to five
times manual output; laser finishing having entirely replaced manual scraping.
Everything else is marked `estimated`. A factory manager will ask why 74, and
"the CSV said so" is not an answer.

## The golden test

`packages/server/tests/golden/fixture-factory.json` is a committed snapshot of the
engine's full output for a factory the test builds itself, at a fixed date. Any change to a risk
score, a training capacity or the scheduling arithmetic appears as a reviewable
diff rather than a number that quietly moved.

```bash
UPDATE_GOLDEN=1 npm test -w @ale/server   # accept an intended change
```

Read the diff before committing it.

## Known limits of v1

**Scoring is still role-level even when the model is active.** The model is
fitted on worker-level features, but a finding describes a role, so the role's
averaged worker profile is scored. Two sewing operators therefore still receive
the same number in the plan. Per-worker plans are the next piece of work, and the
data and the model are both already in place for it.

**A model needs the factory's own history.** Forty recorded outcomes with at
least eight of each result is the floor, and a factory that has never recorded
one gets the rule engine — correctly. There is no cross-factory pooled model yet.

**Training seat capacities are illustrative defaults**, and capacity is the
binding constraint in every schedule, so replace them during onboarding.

No authentication, cohorts assumed sequential.

Full list in [docs/architecture.md](docs/architecture.md).

## Getting your data in

Create a factory, then import CSV exports from your own systems at `/app/import`.
Templates and the full column reference are in
[docs/csv-templates](docs/csv-templates/README.md).

| File | What it is |
| --- | --- |
| `roster.csv` | Headcounts by role — a handful of rows |
| `machinery.csv` | What is arriving and when |
| `workers.csv` | Optional, pseudonymous. **Files containing names are rejected.** |
| `outcomes.csv` | What actually happened after past arrivals |

Every row is validated and failures come back with a line number and a reason, so
a 3,000-row export with a few bad rows is corrected rather than rejected whole.

## The prediction model

The model is trained on `outcomes.csv` and nothing else — there is no pre-trained
model, because there is no data any vendor could honestly have pre-trained it on.

- **Algorithm** — L2-regularised logistic regression, written out in
  `src/ml/logistic.ts`. About sixty lines of arithmetic, readable by the people
  who will argue about its conclusions.
- **Features** — tenure, operations known, skill grade, the automatability of the
  worker's operation, the machine's displacement rate, and the rule engine's role
  score as a prior. Deliberately **not** age, wage, gender or performance rating:
  a model trained on those learns whichever bias produced the historical
  decisions and launders it as a prediction.
- **Validation** — 5-fold stratified cross-validation. Reported AUC, Brier and
  accuracy are all out-of-fold, never training-set.
- **The gate** — the rule engine is scored on the same held-out folds. A model
  that does not beat it is stored but **not activated**, and the rules keep
  producing scores. An equal-performing model is the same answer with less
  explanation.

Until 40 outcomes exist with at least 8 of each result, training refuses and says
so. Every finding carries a badge naming which engine produced its score.

## The two surfaces

| Route | What it is |
| --- | --- |
| `/` | The marketing site — the problem, how it works, the ALE model, and the guardrails |
| `/app/overview` | Dashboard: headline figures, risk by role, monthly training load, upcoming arrivals |
| `/app/plan` | Findings ordered by how soon training must start, plus the training calendar |
| `/app/setup` | The two inputs: role headcounts and the machine roadmap |
| `/app/import` | CSV import with line-level validation and history |
| `/app/model` | Training status, cross-validated metrics, and what the model weighs |
| `/app/machines` | The machine catalogue: cost, throughput, what each unit displaces and creates |
| `/app/knowledge` | Every risk rule with its reasoning, its source and its confidence |
| `/app/report` | The buyer-facing transition report, printable to PDF |

Light and dark themes are both supported. The toggle cycles auto → light → dark
and remembers the choice; **auto** removes the attribute entirely so the
viewer's own `prefers-color-scheme` decides.

