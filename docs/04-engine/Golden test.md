---
title: Golden test
tags: [engine, testing]
---

# Golden test

`packages/server/tests/golden/fixture-factory.json` is a committed snapshot of
the engine's **full output** for a factory the test builds itself, at a fixed
date.

Any change to a risk score, a training capacity or the scheduling arithmetic
appears as a reviewable diff rather than a number that quietly moved.

## Accepting an intended change

```bash
UPDATE_GOLDEN=1 npm test -w @ale/server
```

**Then read the diff before committing it.** That is the entire point.

## What the snapshot excludes

`run.id` and `runAt` are dropped — they are the only non-deterministic fields,
and including them would make every run a diff. The snapshot captures the
engine's output, not the clock.

## It works

When the Bangla labels were removed, the golden test failed. The diff showed:

```
removed keys: roleLabelBn, roleLabelEn
added keys  : roleLabel
value changes in shared keys: NONE
```

Exactly the rename, and **no computed value moved**. That is the assurance the
snapshot exists to give.

## The fixture builds itself

It used to depend on a demo factory in the seed, which meant the expected
output depended on data the product shipped. `makeFixtureFactory()` now builds
the roster and roadmap inside the test file, so the input and the expected
output live together.

## Companion invariants

Three more tests guard properties a snapshot cannot express:

- **The rules version changes when a score changes** — the hash is derived from
  the knowledge base, so an edit is visible in the run history
- **Re-running appends a run** rather than overwriting, so a report sent to a
  buyer stays re-derivable
- **Every commitment completes on or before its machine** — the regression test
  for the lead-time bug in [[Scheduling arithmetic]]

---

Related: [[Rule engine]] · [[Scheduling arithmetic]]
