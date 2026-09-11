---
title: Technology choices
tags: [architecture, decisions]
---

# Technology choices

Each with what it bought and what it cost.

| Choice | Why | Cost |
| --- | --- | --- |
| **`node:sqlite`** | Ships inside Node 22.6+. No native compilation, no build toolchain, no `npm install` that fails without Xcode. For a single-factory deployment the database is a file. | Requires Node 22.6+. The dev server's system Node was v20 — see [[Runbook]]. |
| **Native TypeScript** | `node src/index.ts` runs. `tsc` is used for checking only, never for emitting. | Erasable syntax only: no enums, no parameter properties, `import type` everywhere. |
| **Express** | Six endpoint groups. Everyone who will touch this already knows it. | Nothing notable. |
| **No ORM** | The queries are readable, and the join in `repositories/analysis.ts` is load-bearing — it should be visible. | More typing, and row coercion helpers. |
| **Hand-written logistic regression** | The whole model is ~60 lines of arithmetic. A model whose coefficients decide how a factory treats its workforce should be readable by the people arguing about it. | No GPU, no sparse support, full-batch descent — hence the sampling cap in [[Training pipeline]]. |
| **Hand-written CSV parser** | `split(',')` corrupts every row containing a quoted comma, which here means every `"Finishing, Ironing & Pressing"`. Failure is silent. | ~80 lines to maintain. |
| **MUI + Material 3** | A complete component system, and M3's tonal palettes give contrast guarantees by construction. | ~200KB gzip. Mitigated with route-level code splitting. |
| **Vite** | Fast dev server, real code splitting, `import.meta.env` for the dev-tools gate. | Nothing notable. |
| **pm2** | Already the house pattern on the target host. | Needs the Node 22 interpreter pinned explicitly. |

## What was deliberately not used

**No machine learning at v1.** The rule engine runs on day one with no training
data. ML arrived only once there was a way to record real outcomes — see
[[ML overview]].

**No authentication.** Deliberately out of scope. `factory_id` is threaded
through every table, so multi-tenancy is a routing change rather than a
migration.

**No job queue.** The slowest operations — a million-row import at ~50s,
training at ~27s — are synchronous. A queue would be the right answer at
multi-tenant scale; at one factory it is machinery without a purpose.

---

Related: [[System architecture]] · [[Decision log]] · [[Deployment]]
