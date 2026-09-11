[← Documentation index](../README.md)

# Deployment

One Node process behind one nginx `proxy_pass`. The server serves both the
built frontend and `/api`, so nginx never changes when the app is rebuilt and
there is no static root to keep in step.

```mermaid
sequenceDiagram
    autonumber
    actor D as You
    participant L as Local machine
    participant S as Server (raju@host)
    participant R as root
    participant CF as Cloudflare

    D->>L: rsync (excluding node_modules,<br/>dist, data, generated)
    L->>S: source, ~1MB

    D->>S: npm ci
    Note over S: NOT --omit=optional —<br/>Rollup needs its platform binary
    D->>S: npm run build
    D->>S: npm run db:reset
    Note over S: reference data only,<br/>no factories

    D->>S: pm2 start deploy/ecosystem.config.cjs
    Note over S: interpreter pinned to<br/>nvm Node 22 absolute path
    D->>S: pm2 save

    D->>R: sudo cp deploy/nginx.conf → sites-available
    D->>R: sudo ln -s → sites-enabled
    D->>R: sudo nginx -t && sudo systemctl reload nginx
    Note over R: the && is not decoration —<br/>a broken config takes down<br/>every other site on the host
    D->>R: sudo certbot --nginx -d your.domain

    CF->>S: :443 → nginx → 127.0.0.1:PORT
```

## Requirements

**Node 22.6 or newer.** The app uses `node:sqlite` and native TypeScript
execution, neither of which exists on Node 20.

If the host's system Node is older, install 22 with nvm and **pin the absolute
path** in `ecosystem.config.cjs`. pm2 does not inherit a shell's nvm setup, so
a process that runs fine interactively still fails to start under pm2 without
it. This bit during the first deploy.

## Redeploying

```bash
rsync ...
npm run build
pm2 restart worker-saver
```

No nginx change needed.

## Enabling the demo fill buttons

```bash
VITE_ALE_DEMO_TOOLS=1 npm run build
```

Unset, the branch tree-shakes away entirely. See [Pages and navigation](../07-interface/pages-and-navigation.md).

## Live deployment

| | |
| --- | --- |
| URL | `https://worker-saver.shagato.space` |
| Process | pm2 `worker-saver`, port 28710 |
| Node | v22.23.1 via nvm, pinned |
| Reboot | `pm2-raju` enabled, process list saved |

The host runs ~44 other sites. Port 28710 was chosen after checking what was
free; nothing else was touched.

---

Related: [Runbook](runbook.md) · [Configuration](configuration.md) · [System architecture](../02-architecture/system-architecture.md)
