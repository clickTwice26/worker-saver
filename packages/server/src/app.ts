import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.ts';
import { HttpError, sendError } from './lib/http.ts';
import { apiRoutes } from './routes/index.ts';

export function createApp(db: DatabaseSync): express.Express {
  const app = express();

  // A worker-level export from an HR system runs to megabytes of CSV.
  app.use(express.json({ limit: '25mb' }));

  // The Vite dev server runs on a different port in development. A deployment
  // serves the built frontend from the same origin and needs none of this.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.webOrigin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use('/api', apiRoutes(db));

  /**
   * Serve the built frontend in production.
   *
   * Skipped when the build is absent, which is the normal case in development —
   * Vite serves the frontend there and proxies `/api` to this process.
   */
  if (existsSync(join(config.webDist, 'index.html'))) {
    app.use(express.static(config.webDist, {
      // Hashed asset filenames can be cached hard; index.html must not be, or a
      // deploy leaves browsers pinned to the previous build's asset names.
      setHeaders: (res, path) => {
        if (path.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        else if (path.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));

    // Client-side routing: anything that is not an API call or a real file is
    // handed to the SPA, so a deep link like /app/model survives a refresh.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(join(config.webDist, 'index.html'));
    });
  }

  app.use((_req, res) => {
    sendError(res, HttpError.notFound('No such endpoint.'));
  });

  // Express 4 identifies an error handler by its arity, so `next` must stay.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      sendError(res, error);
      return;
    }
    console.error('Unhandled error:', error);
    sendError(res, new HttpError(500, 'internal_error', 'Something went wrong handling that request.'));
  });

  return app;
}
