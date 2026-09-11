import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { HttpError } from '../lib/http.ts';
import { asObject, optionalIsoDate, parseId } from '../lib/validate.ts';
import * as factoryRepo from '../repositories/factory.ts';
import * as analysisRepo from '../repositories/analysis.ts';
import { buildReport, getLatestPlan, getPlan, runAnalysis } from '../services/analysis-service.ts';

/** Running the engine, and reading its output. */
export function analysisRoutes(db: DatabaseSync): Router {
  const router = Router();

  const requireFactory = (raw: string | undefined): number => {
    const id = parseId(raw, 'factoryId');
    if (!factoryRepo.getFactory(db, id)) throw HttpError.notFound(`No factory with id ${id}.`);
    return id;
  };

  /**
   * Run the analysis.
   *
   * `asOfDate` overrides today, which is what makes a run reproducible: the same
   * roster and roadmap replayed against the same date produce the same findings.
   */
  router.post('/factories/:factoryId/run-analysis', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const asOfDate = optionalIsoDate(asObject(req.body ?? {}), 'asOfDate');

    const { run, gaps } = runAnalysis(db, factoryId, asOfDate);
    res.status(201).json({ run, findingCount: run.findingCount, gaps });
  });

  /** The latest plan. Runs the analysis on first call so the page is never empty. */
  router.get('/factories/:factoryId/plan', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const plan = getLatestPlan(db, factoryId);
    if (!plan) throw HttpError.notFound(`No plan available for factory ${factoryId}.`);
    res.json(plan);
  });

  router.get('/runs/:runId/plan', (req, res) => {
    const run = analysisRepo.getRun(db, parseId(req.params.runId, 'runId'));
    if (!run) throw HttpError.notFound(`No run with id ${req.params.runId}.`);

    const plan = getPlan(db, run);
    if (!plan) throw HttpError.notFound(`Run ${run.id} references a factory that no longer exists.`);
    res.json(plan);
  });

  router.get('/factories/:factoryId/runs', (req, res) => {
    res.json(analysisRepo.listRuns(db, requireFactory(req.params.factoryId)));
  });

  /**
   * The buyer-facing transition report.
   *
   * The only exportable document in the API. There is deliberately no endpoint
   * returning a bare ranked risk list — see docs/ethics.md.
   */
  router.get('/factories/:factoryId/report', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const plan = getLatestPlan(db, factoryId);
    if (!plan) throw HttpError.notFound(`No plan available for factory ${factoryId}.`);
    res.json(buildReport(plan));
  });

  return router;
}
