# Design constraints on misuse

This is an engineering document, not a values statement. Everything below is
enforced in code, and the tests that hold each constraint in place are named.

## The problem

The output that says *"train these 40 people first"* is the same output that says
*"these 40 are the most replaceable."* ALE Insight builds a ranked list of who is
easiest to automate away, and hands it to the party who would do the automating.

Used the wrong way this is a redundancy-selection instrument — the precise
inverse of what the product exists to do. That risk is not managed by intent. It
is managed in the schema.

## The four constraints

### 1. No risk score exists without a paired action

`findings.training_program_id` is `NOT NULL`
(`packages/server/src/db/migrations/001_init.sql`).

A role the engine cannot recommend a transition for produces a **coverage gap**,
reported separately, rather than a score with an empty action column. The engine
enforces this before the database does — `analyze()` skips any role with no
matching training programme and records the reason.

*Held by:* `a role with no training programme yields a gap, not a risk score`
(`tests/engine.test.ts`), and the `NOT NULL` constraint itself.

### 2. The exportable document is the transition plan, never the risk register

`GET /api/factories/:id/report` returns dated training commitments. There is no
endpoint anywhere in the API that returns a bare ranked displaceability list, and
adding one would be a change to reject in review.

*Held by:* `the report exposes commitments, not a ranked risk register`
(`tests/api.test.ts`).

### 3. Worker records are pseudonymous by default

The product runs on **role headcounts**, so v1 needs no worker names at all to be
useful. The `workers` table exists for phase 4 and stores `external_ref` — the
factory's own HR identifier — with no name column. Names belong at training
enrolment, where they are actually needed, and nowhere else.

This also removes the largest adoption obstacle: a factory can get value without
handing over personal data about 3,470 people.

### 4. Every run is attributable and reproducible

`analysis_runs` records the as-of date, the engine version and a content hash of
the knowledge base. A report sent to a buyer eight months ago can be re-derived
exactly. When user accounts arrive, the user id joins this table.

*Held by:* `re-running the analysis appends a run rather than overwriting the
last` and `the rules version changes when a risk score changes`
(`tests/engine.golden.test.ts`).

## Honest numbers

Every risk row carries `rationale`, `source_ref` and `confidence`, all `NOT NULL`.
Each of the eight seeded rows is marked `estimated`, because its score comes from
the ALE Insight dashboard concept — demo data, not measurement — and the
interface displays that marking beside the number rather than in a footnote.

Promoting a row to `sourced` requires a primary citation. That work is phase 0 of
the build plan.

## Design-partner terms

Not enforceable in code, and stated in the agreement instead: the tool is not to
be used as an input to redundancy selection.
