import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { computeRulesVersion, ENGINE_VERSION } from '../engine/index.ts';
import * as reference from '../repositories/reference.ts';
import * as factoryRepo from '../repositories/factory.ts';

/** Reference data: roles, the knowledge base, and the training catalogue. */
export function referenceRoutes(db: DatabaseSync): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      engineVersion: ENGINE_VERSION,
      rulesVersion: computeRulesVersion(db),
      database: 'connected',
    });
  });

  router.get('/roles', (_req, res) => {
    res.json(reference.listRoles(db));
  });

  router.get('/factories', (_req, res) => {
    res.json(factoryRepo.listFactories(db));
  });

  /**
   * The knowledge base, exposed so the interface can show the reasoning and the
   * provenance behind a score rather than only the number.
   */
  router.get('/risk-rules', (_req, res) => {
    res.json(reference.listRiskRules(db));
  });

  router.get('/training-programs', (_req, res) => {
    res.json(reference.listTrainingPrograms(db));
  });

  /**
   * The machine catalogue.
   *
   * The reference data behind every displacement figure — what each machine
   * replaces, what it costs, how many people it needs to run, and what it
   * creates. Exposed so the interface can show the derivation rather than
   * presenting a number with no visible origin.
   */
  router.get('/machine-types', (_req, res) => {
    res.json(reference.listMachineTypes(db));
  });

  router.get('/operations', (_req, res) => {
    res.json(reference.listOperations(db));
  });

  return router;
}
