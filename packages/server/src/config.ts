import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const config = {
  /** Package root, resolved from this file so scripts work from any cwd. */
  root: resolve(here, '..'),
  databasePath: process.env.ALE_DB_PATH ?? resolve(here, '..', 'data', 'ale.db'),
  port: Number(process.env.PORT ?? 7420),
  /** Vite dev server, allowed through CORS in development. */
  webOrigin: process.env.ALE_WEB_ORIGIN ?? 'http://localhost:7430',
  /**
   * Where generated CSV datasets live.
   *
   * Files here are imported server-side rather than posted through the browser:
   * a million-row outcomes file is ~140MB, and round-tripping that as a JSON
   * string would both exceed the body limit and double in memory on the way.
   */
  datasetsDir: process.env.ALE_DATASETS_DIR ?? resolve(here, '..', '..', '..', 'generated'),
  /**
   * The built frontend, served by this process in production.
   *
   * One process behind one `proxy_pass` keeps the nginx config to a single
   * upstream, and means the app can be restarted without touching nginx.
   */
  webDist: process.env.ALE_WEB_DIST ?? resolve(here, '..', '..', 'web', 'dist'),
  isProduction: process.env.NODE_ENV === 'production',
} as const;
