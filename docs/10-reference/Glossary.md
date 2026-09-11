---
title: Glossary
tags: [reference]
---

# Glossary

| Term | |
| --- | --- |
| **Arrival** | A dated machine purchase landing on the floor. The event everything is scheduled backwards from. |
| **AUC** | Probability a randomly chosen displaced worker scores above a randomly chosen retained one. 0.5 = random. |
| **Band** | `high` · `moderate` · `low`. From the knowledge base, never from the model. |
| **Baseline** | The rule engine's score, measured on the same held-out folds as the model. See [[The baseline gate]]. |
| **Brier score** | Mean squared error on probabilities. Rewards calibration, not just ranking. |
| **Calibration** | Whether a predicted 0.7 actually happens 70% of the time. |
| **Cohort** | One monthly training intake. Capacity per cohort is `seats_per_month`. |
| **Coverage gap** | A machinery plan the engine could not answer for. Reported, never emitted as a bare score. |
| **Displaced** | The positive class for the displacement model. `redeployed` counts as retained. |
| **Exposure concentration** | `automatability × share of time`. The interaction a linear model cannot form itself. |
| **Finding** | One row of output: a role, an arrival, a training programme and a date. |
| **Golden file** | A committed snapshot of full engine output. See [[Golden test]]. |
| **Group-aware folds** | Cross-validation keeping all of one worker's rows on the same side. |
| **Lead time** | `(cohorts-1) × 30 + durationWeeks × 7`. Days of training needed before an arrival. |
| **Net workforce change** | Created minus displaced. Frequently not the figure a factory expects. |
| **Operation** | A granular task. **Machines replace operations, not roles.** |
| **Outcome** | A recorded result after a past arrival. The only source of ML labels. |
| **Payback** | Capital cost over the **net** monthly wage bill removed. |
| **Permutation importance** | AUC lost when a feature is shuffled. What the model actually relies on. |
| **Provenance** | `source_ref` + `confidence` on every figure. `sourced` or `estimated`. |
| **Retraining cost ratio** | Training bill against one year of the payroll it protects. Runs 2–5%. |
| **Roster** | Headcounts by role. The low-friction input. |
| **Rules version** | Content hash of the knowledge base, recorded on every run. |
| **Schedule status** | `on_track` · `starts_soon` · `overdue`. |
| **Score source** | `rules` or `model`. Recorded on every finding and shown in the UI. |
| **Start-by date** | The latest training can begin and still finish before the machine lands. |
| **Synonym table** | Normalised spellings mapping to canonical role ids. |
| **Weighted risk** | Headcount-weighted mean of role base scores. Independent of the machine roadmap. |
| **Worker ref** | The factory's own pseudonymous HR identifier. Never a name. |
