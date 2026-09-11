import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { referenceRoutes } from './reference.ts';
import { factoryRoutes } from './factory.ts';
import { analysisRoutes } from './analysis.ts';
import { dataRoutes } from './data.ts';

export function apiRoutes(db: DatabaseSync): Router {
  const router = Router();
  router.use(referenceRoutes(db));
  router.use(factoryRoutes(db));
  router.use(analysisRoutes(db));
  router.use(dataRoutes(db));
  return router;
}
