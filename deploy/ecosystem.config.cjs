/**
 * pm2 process definition.
 *
 * `interpreter` is pinned to the nvm-managed Node 22 explicitly: the system
 * Node on this host is v20, which has neither `node:sqlite` nor native
 * TypeScript execution, so the app would fail to start under pm2 defaults even
 * though it runs fine in an interactive shell that has sourced nvm.
 */
module.exports = {
  apps: [{
    name: "worker-saver",
    script: "packages/server/src/index.ts",
    cwd: "/home/raju/apps/worker-saver",
    interpreter: "/home/raju/.nvm/versions/node/v22.23.1/bin/node",
    env: {
      NODE_ENV: "production",
      PORT: "28710",
      // The app serves its own frontend, so nginx needs only one upstream.
      ALE_WEB_DIST: "/home/raju/apps/worker-saver/packages/web/dist",
      ALE_DATASETS_DIR: "/home/raju/apps/worker-saver/generated",
    },
    max_memory_restart: "700M",
    autorestart: true,
  }],
};
