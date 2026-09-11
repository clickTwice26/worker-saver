[← Documentation index](../README.md)

# System architecture

Three packages, one dependency direction, no cycles.

```mermaid
flowchart TB
    subgraph web["packages/web — Vite + React + MUI"]
        SITE["site/<br/>marketing page"]
        APP["app/<br/>shell, factory context"]
        PAGES["pages/<br/>Overview, Plan, Setup,<br/>Import, Model, Machines,<br/>Knowledge, Report"]
        THEME["theme/<br/>Material 3 tonal palette"]
    end

    subgraph shared["packages/shared"]
        TYPES["Domain and API types<br/>the contract both sides compile against"]
    end

    subgraph server["packages/server — Express + node:sqlite"]
        ROUTES["routes/<br/>HTTP, validation, status codes"]
        SERVICES["services/<br/>orchestration, transactions, the clock"]
        ENGINE["engine/<br/>pure functions"]
        ML["ml/<br/>features, logistic, trees, metrics"]
        REPOS["repositories/<br/>SQL and row mapping"]
        DB[("SQLite<br/>migrations + seed")]
    end

    PAGES --> APP --> SITE
    web -. "import type" .-> TYPES
    server -. "import type" .-> TYPES

    ROUTES --> SERVICES
    SERVICES --> ENGINE
    SERVICES --> ML
    SERVICES --> REPOS
    REPOS --> DB

    web -->|"HTTP /api"| ROUTES

    style TYPES fill:#e7f0fd,stroke:#1E40AF
    style ENGINE fill:#e8f4ea,stroke:#2d6a4f
    style ML fill:#e8f4ea,stroke:#2d6a4f
```

## The layers, and what each may not do

| Layer | Does | Must never |
| --- | --- | --- |
| `routes/` | Validation, status codes, error shapes | Contain business logic |
| `services/` | Orchestration, transactions, reads the clock | Contain arithmetic worth testing alone |
| `engine/` | Pure functions | Touch the database, the clock, or randomness |
| `ml/` | Fit, score, evaluate | Touch the database |
| `repositories/` | SQL and row mapping | Make decisions |

**The engine is pure on purpose.** It is what makes the [Golden test](../04-engine/golden-test.md)
possible, and it is the part most likely to change as the knowledge base
grows. `asOfDate` is passed in rather than read from a clock, so a run is
reproducible years later.

## Why the shared package exists

Both sides `import type` from `@ale/shared`. A renamed field becomes a
compile error on both sides instead of a silently empty panel in the browser.

Because every server import is type-only, Node erases them entirely — the
server never loads that package at runtime.

## In production

One process serves both the built frontend and `/api`:

```mermaid
flowchart LR
    U(["Browser"]) -->|"HTTPS"| CF["Cloudflare"]
    CF -->|":443"| NG["nginx<br/>one proxy_pass"]
    NG -->|":28710"| N["Node 22<br/>under pm2"]
    N --> S[("SQLite file")]
    N --> D["packages/web/dist<br/>static assets"]

    style NG fill:#fff3cd,stroke:#856404
```

One upstream means nginx never changes when the app is rebuilt, and there is
no static root to keep in step with a deploy. See [Deployment](../08-operations/deployment.md).

---

Related: [Data model](data-model.md) · [Request lifecycle](request-lifecycle.md) · [Technology choices](technology-choices.md)
