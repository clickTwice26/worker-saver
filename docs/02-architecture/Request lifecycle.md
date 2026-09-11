---
title: Request lifecycle
tags: [architecture, sequence]
---

# Request lifecycle

What happens between clicking **Run analysis** and a number appearing.

```mermaid
sequenceDiagram
    autonumber
    actor U as Production manager
    participant W as Browser (React)
    participant N as nginx
    participant R as routes/analysis
    participant S as services/analysis
    participant M as services/model
    participant E as engine/analyze
    participant DB as SQLite

    U->>W: Run analysis
    W->>N: POST /api/factories/1/run-analysis
    N->>R: proxy_pass :28710

    R->>R: validate factory id, optional asOfDate
    R->>S: runAnalysis(db, factoryId, asOfDate)

    Note over S,DB: Assemble engine input
    S->>DB: roles, headcounts, machinery plans
    S->>DB: risk rules, training programmes
    S->>DB: machine catalogue, wage bands
    DB-->>S: reference + customer data

    S->>M: getActiveModel(factoryId)
    alt a trained model is active
        M->>DB: read stored weights
        M-->>S: per-role probabilities
    else no model yet
        M-->>S: none — rules govern
    end

    S->>E: analyze(input)
    Note over E: Pure. No clock,<br/>no database, no randomness.

    loop each machinery plan
        E->>E: resolve headcount, rule, programme
        E->>E: displaced = units x catalogue rate
        E->>E: created = units x operators needed
        E->>E: cohorts = ceil(affected / seats per month)
        E->>E: startBy = arrival - leadTimeDays
        E->>E: payback = capital / monthly saving
    end
    E-->>S: findings + coverage gaps

    S->>DB: BEGIN
    S->>DB: INSERT analysis_runs (asOf, engine, rules hash)
    S->>DB: INSERT findings
    S->>DB: COMMIT

    S-->>R: run + gaps
    R-->>W: 201 { run, findingCount, gaps }
    W->>N: GET /api/factories/1/plan
    N->>R: proxy_pass
    R->>S: getPlan(run)
    S->>DB: findings joined to roles, machines, programmes
    S->>S: buildSchedule() + computeTotals()
    S-->>W: plan
    W-->>U: schedule, economics, arrivals
```

## Things worth noticing

**Step 4 — the model is consulted, not assumed.** If no model is active, or a
stored model has no usable payload, the rules produce the score and the finding
records `score_source: "rules"`.

**The engine loop never touches the database.** Every value it needs was
gathered in steps 5–7. That is what makes [[Golden test|the golden snapshot]]
possible.

**The write is one transaction.** A partially-written run would be worse than
no run: the report built from it would be internally inconsistent.

**Reading the plan is a second request.** Running the analysis produces a run
id; rendering is a separate read. That keeps a slow analysis from blocking the
page, and lets an old run be re-read by id at any time.

## A CSV import, for contrast

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as Browser
    participant R as routes/data
    participant I as services/import
    participant DB as SQLite

    alt small file, uploaded
        U->>W: choose roster.csv
        W->>W: file.text()
        W->>R: POST /import/roster { csv }
    else large dataset, already on the server
        U->>W: click Import on a dataset
        W->>R: POST /datasets/million/import
        R->>I: readFileSync — never through the browser
    end

    I->>I: parseCsv (quotes, escapes, BOM)
    loop each row
        I->>DB: resolve role via synonym table
        alt row valid
            I->>DB: upsert
        else row invalid
            I->>I: record { line, message }
        end
    end
    I->>DB: INSERT import_batches (accepted, rejected, errors)
    I-->>R: result
    R-->>W: 200 if any accepted, else 422
    W-->>U: "1,204 of 1,210 imported" + errors by line
```

Partial success is the normal case. A 3,000-row HR export will have a handful
of bad rows, and `row 812: unknown role "Sewing Opr"` is actionable where
"import failed" is not. See [[CSV import]].

---

Related: [[Rule engine]] · [[CSV import]] · [[System architecture]]
