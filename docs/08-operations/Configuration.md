---
title: Configuration
tags: [operations, reference]
---

# Configuration

## Environment variables

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `7420` | API and static server |
| `NODE_ENV` | — | `production` enables static serving of the built frontend |
| `ALE_WEB_DIST` | `packages/web/dist` | Built frontend to serve |
| `ALE_DATASETS_DIR` | `./generated` | CSV datasets importable from the UI |
| `ALE_DB_PATH` | `packages/server/data/ale.db` | SQLite file |
| `ALE_WEB_ORIGIN` | `http://localhost:7430` | CORS origin, development only |

## Build-time flags

| Variable | |
| --- | --- |
| `VITE_ALE_DEMO_TOOLS=1` | Compiles the development fill buttons into the build. Unset, they tree-shake away. |
| `ALE_WEB_PORT` | Vite dev server port, default `7430` |

## Commands

| | |
| --- | --- |
| `npm run setup` | Install, migrate, load reference data |
| `npm run dev` | API and web dev server together, one Ctrl-C |
| `npm test` | 85 tests |
| `npm run typecheck` | All three packages |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run build` | Production build of the frontend |
| `npm run generate:data` | Synthetic CSVs — see [[Data generator]] |

## Ports

Both are overridable, and **Vite runs with `strictPort`**: it refuses to start
on a different port rather than sliding to the next free one.

The API allows exactly one CORS origin, so a silent slide would break every
request in a way that looks like a bug in the app.

```bash
PORT=8420 ALE_WEB_PORT=8430 npm run dev
```

---

Related: [[Deployment]] · [[Runbook]]
