import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/** Kept in step with `packages/server/src/config.ts`. */
const WEB_PORT = Number(process.env.ALE_WEB_PORT ?? 7430);
const API_PORT = Number(process.env.PORT ?? 7420);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolved explicitly rather than through the workspace symlink, so Vite
      // transpiles the shared types as source instead of treating them as a
      // pre-built dependency.
      '@ale/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: WEB_PORT,
    // Fail rather than sliding to the next free port. The API allows this exact
    // origin through CORS, so a silent move would break requests in a way that
    // looks like a bug in the app.
    strictPort: true,
    proxy: {
      // Same-origin in development, so the app needs no API base URL.
      '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
