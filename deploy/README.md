# Deployment

The app is one Node process behind one nginx `proxy_pass`: the server serves
both the built frontend and `/api`. That means nginx never has to change when
the app is rebuilt, and there is no static root to keep in step with a deploy.

## Requirements

**Node 22.6 or newer.** The app uses Node's built-in `node:sqlite` and native
TypeScript execution, neither of which exists on Node 20. If the host's system
Node is older, install 22 with nvm and pin the absolute path in
`ecosystem.config.cjs` — pm2 does not inherit a shell's nvm setup, so a process
that runs fine interactively will still fail to start under pm2 without it.

## First deploy

```bash
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude packages/server/data \
  --exclude generated --exclude packages/web/dist \
  ./ your-host:~/apps/worker-saver/

ssh your-host
cd ~/apps/worker-saver
npm ci                 # not --omit=optional: Rollup needs its platform binary
npm run build
npm run db:reset       # reference data only; no factories are seeded
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

Then, as root:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/worker-saver.example.com
sudo ln -s /etc/nginx/sites-available/worker-saver.example.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d worker-saver.example.com
```

`nginx -t &&` is not decoration. On a host with other sites, reloading a broken
config takes all of them down; validating first means a bad config fails safe.

## Redeploying

```bash
rsync ...                       # as above
npm run build
pm2 restart worker-saver
```

No nginx change is needed.

## Enabling the demo fill buttons

The development-only "Fill" buttons are compiled out of a production build. A
demo deployment can opt in explicitly at build time:

```bash
VITE_ALE_DEMO_TOOLS=1 npm run build
```

Unset, the branch tree-shakes away entirely, so the safe default holds for any
build that does not ask for it.

## Environment

| Variable | Default | |
| --- | --- | --- |
| `PORT` | 7420 | API and static server |
| `ALE_WEB_DIST` | `packages/web/dist` | Built frontend to serve |
| `ALE_DATASETS_DIR` | `./generated` | CSVs importable from the UI |
| `ALE_DB_PATH` | `packages/server/data/ale.db` | SQLite file |
| `ALE_WEB_ORIGIN` | `http://localhost:7430` | CORS origin, development only |
