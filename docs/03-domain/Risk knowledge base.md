---
title: Risk knowledge base
tags: [domain, reference-data, provenance]
---

# Risk knowledge base

18 rules across 16 roles. Every one carries three `NOT NULL` columns beyond
the score: `rationale`, `source_ref`, `confidence`.

> A factory manager **will** ask why 74. "The CSV said so" ends the meeting.

## How a score is derived

Four factors, stated in each rationale rather than computed by formula:

1. **Task specifiability** — can the work be written down exactly?
2. **Machine capability overlap** — how much does current equipment cover?
3. **Retraining difficulty** — how far is the nearest surviving role?
4. **Labour substitutability** — how easily is the worker redeployed?

## The anchor scores

Reproduce the role-level figures from the ALE Insight dashboard concept, which
is explicitly demo data:

| Role | Score | Band |
| --- | --- | --- |
| Cutting Machine Operators | 74 | High |
| Sewing Machine Operators | 68 | High |
| Packing Staff | 55 | Moderate |
| Finishing & Ironing Staff | 41 | Moderate |
| Fabric & Pattern Cutters | 30 | Moderate |
| Quality Inspectors | 22 | Low |
| Line Supervisors | 15 | Low |
| Maintenance Technicians | 8 | Low |

Two of those deserve attention because they run against intuition:

**Maintenance Technicians, 8.** Demand *rises* with automation. The risk is a
skills gap, not displacement.

**Quality Inspectors, 22.** Machine vision augments rather than replaces —
exception handling and buyer-specific tolerance calls stay human. The role
changes shape more than it shrinks.

## Everything is marked `estimated`

All 18 rows. The scores come from demo data, not measurement, and the interface
shows that marking **beside the number** rather than in a footnote.

Promoting a row to `sourced` requires a primary citation. That is phase-0 work.

## Where several rules exist for one role

The engine plans against the **most exposed** one. A secondary trigger
documents a lesser scenario without changing the plan — for example sewing
operators score 68 against automated sewing units and 45 against template-based
jigs, because a jig compresses the skill premium rather than removing the post.

---

Related: [[Machine catalogue]] · [[Rule engine]] · [[Ethical constraints]]
