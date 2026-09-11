[← Documentation index](../README.md)

# Decision log

Choices made, why, and what would reverse them.

## Build a capacity planner, not a risk detector

**Why.** The original specification asked a factory to type 1,420 worker
records to learn one sentence — every operator returning the same score, the
same recommendation, the same date. `tenure_months` was collected and never
read. The output of an afternoon of data entry was a fact the production
manager already believed.

**Reversed if** validation shows managers want the score alone and will not
maintain a machine roadmap.

## Role headcounts, not worker records

**Why.** Eight rows instead of 3,470, and no personal data needed to deliver
value. Removes the largest adoption obstacle.

**Reversed if** worker-level plans become the primary output — the data model
already supports it.

## No machine learning at v1

**Why.** No labelled data existed. A rule engine works on day one.

**Reversed** — it was, once outcome recording made labels possible. The rule
engine remains the fallback and the baseline.

## A canonical role table with synonyms

**Why.** Three spellings of one role never matched; the engine's first run
would have returned nothing.

**Reversed if** never. This is the correct shape.

## Compute displacement from a catalogue

**Why.** `headcount_displaced_per_unit` typed in by the user was the product
asking the factory for the answer it exists to supply.

**Reversed if** factories consistently override the catalogue — which would
mean the reference data is wrong, not the design.

## The baseline gate

**Why.** A model that cannot beat a transparent lookup is the same answer with
less explanation. See [The baseline gate](../05-machine-learning/the-baseline-gate.md).

**Reversed if** never. Weakening this is the change to reject in review.

## Subsample above 25,000 rows

**Why.** Full-batch descent is O(iterations × rows × features) per candidate
per fold. At a million rows that is tens of billions of operations; the
standard error on AUC at 25k is already ~0.006.

**Reversed if** the optimiser moves to mini-batch SGD, which would make the cap
unnecessary.

## `redeployed` counts as retained

**Why.** The worker kept a job, which is the outcome the product exists to
produce. Counting it as displacement would train the model to call a success a
failure.

**Reversed if** never.

## Exclude age, wage, gender, qualification, performance rating

**Why.** A model trained on those learns whichever bias produced the historical
decisions and launders it as a prediction. See [Features](../05-machine-learning/features.md).

**Reversed if** never for performance rating and wage. Gender may be collected
**in aggregate at role level** for impact reporting, never per worker.

## `time_to_competency_weeks` instead of an aptitude rating

**Why.** There is no clean measurement of "learning ability". A supervisor
rating is a proxy for supervisor opinion, carrying gender, age and favouritism
bias. Ramp-up weeks are observed, objective and already recorded in most IE
systems.

## Ship no demo factory

**Why.** A seeded demo factory puts invented numbers where a user expects their
own. Reference data is a knowledge base; a roster belongs to a customer.

**Reversed if** never. The [Data generator](../06-data/data-generator.md) covers the demo need without
shipping fake customers.

## Amber is the moderate band, not the CTA

**Why.** The generated M3 palette nominates amber as the accent, but in a
product whose output is a risk band, a button and a badge sharing a colour
makes the most important signal ambiguous. See [Design system](../07-interface/design-system.md).

## One process serves frontend and API

**Why.** One nginx upstream means nginx never changes on a redeploy, and there
is no static root to keep in step.

**Reversed if** the frontend moves to a CDN.

---

Related: [Technology choices](../02-architecture/technology-choices.md) · [Ethical constraints](../09-ethics/ethical-constraints.md)
