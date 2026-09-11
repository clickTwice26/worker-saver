[← Documentation index](../README.md)

# Runbook

Things that have actually gone wrong, and what to do.

## `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`

The process is on **Node 20**. pm2 does not inherit nvm from your shell.

```bash
node -v                                  # in the pm2 process, not your shell
pm2 describe worker-saver | grep interp
```

Pin the absolute path in `ecosystem.config.cjs`, then `pm2 restart
worker-saver --update-env`.

## Build fails with `MODULE_NOT_FOUND` in `rollup/dist/native.js`

`npm ci --omit=optional` skipped Rollup's platform binary
(`@rollup/rollup-linux-x64-gnu`).

```bash
rm -rf node_modules packages/*/node_modules
npm ci        # no --omit=optional
```

## 502 from Cloudflare

nginx has no vhost for the hostname. Check with a **capital** `-R`:

```bash
grep -Rn "your.domain" /etc/nginx/sites-enabled/
```

> `grep -r` **silently skips symlinks**, and almost every enabled site is a
> symlink. This produced a wrong diagnosis once — `-r` found nothing and the
> conclusion was "no vhost matches", when a wildcard vhost was claiming the
> hostname all along.

## A subdomain serves the wrong application

Look for a wildcard `server_name`:

```bash
grep -Rn "server_name" /etc/nginx/sites-enabled/ | grep '\*'
```

An exact `server_name` **beats a wildcard** in nginx, so adding a vhost with
the literal hostname fixes it without touching the wildcard.

## Training takes minutes

Check `rowsUsed` against `outcomesRecorded` in the model status. Above 25,000
rows the dataset is subsampled — if it is not, the cap has been raised or
bypassed. See [Training pipeline](../05-machine-learning/training-pipeline.md).

## A model trains but never activates

Working as designed. Read the message — it will name the model's AUC against
the rule baseline. See [The baseline gate](../05-machine-learning/the-baseline-gate.md).

## The plan is empty after importing

Check for coverage gaps in the `run-analysis` response:

| reason | meaning |
| --- | --- |
| `no_headcount` | The machine's role has no workers on the roster |
| `no_risk_rule` | No rule for that role |
| `no_training_program` | **Deliberate** — no score without an action |

## An import rejects everything

Read the first few `errors`. Common causes: a role name not in the synonym
table, a date not in `YYYY-MM-DD`, or a `name` column in a workers file (which
is rejected by design).

## First page load hangs after a large import

SQLite checkpointing a large WAL, and possibly Vite re-optimising dependencies.
It resolves on its own — this looked like a 28-second API hang once and was
0.01s on retry.

```bash
ls -lh packages/server/data/    # a large .db-wal confirms it
```

---

Related: [Deployment](deployment.md) · [Configuration](configuration.md)
