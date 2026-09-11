import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { HttpError } from '../lib/http.ts';
import { asObject, parseId, requireString, optionalString } from '../lib/validate.ts';
import * as factoryRepo from '../repositories/factory.ts';
import {
  IMPORT_COLUMNS, importMachinery, importOutcomes, importRoster, importWorkers,
  type ImportKind,
} from '../services/import-service.ts';
import { getStatus, trainForFactory } from '../services/model-service.ts';
import { importDataset, listDatasets } from '../services/dataset-service.ts';
import type { Target } from '../ml/train.ts';
import { num, str, type Row } from '../repositories/row.ts';

const IMPORTERS = {
  roster: importRoster,
  machinery: importMachinery,
  workers: importWorkers,
  outcomes: importOutcomes,
} as const;

/** Factory management, CSV import, and the model. */
export function dataRoutes(db: DatabaseSync): Router {
  const router = Router();

  const requireFactory = (raw: string | undefined): number => {
    const id = parseId(raw, 'factoryId');
    if (!factoryRepo.getFactory(db, id)) throw HttpError.notFound(`No factory with id ${id}.`);
    return id;
  };

  // --- factories ----------------------------------------------------------

  router.post('/factories', (req, res) => {
    const body = asObject(req.body);
    const name = requireString(body, 'name');

    const existing = db.prepare('SELECT id FROM factories WHERE name = ?').get(name);
    if (existing) {
      throw new HttpError(409, 'conflict', `A factory named "${name}" already exists.`);
    }

    const id = Number(db.prepare(
      'INSERT INTO factories (name, location, product_mix, is_demo) VALUES (?, ?, ?, 0)',
    ).run(name, optionalString(body, 'location') ?? '', optionalString(body, 'productMix') ?? '')
      .lastInsertRowid);

    res.status(201).json(factoryRepo.getFactory(db, id));
  });

  router.delete('/factories/:factoryId', (req, res) => {
    const id = requireFactory(req.params.factoryId);
    db.prepare('DELETE FROM factories WHERE id = ?').run(id);
    res.status(204).end();
  });

  // --- imports ------------------------------------------------------------

  /** The accepted columns, so the format is discoverable from the product. */
  router.get('/import/columns', (_req, res) => {
    res.json(IMPORT_COLUMNS);
  });

  /**
   * Import a CSV.
   *
   * The body carries the file as text rather than multipart: the payload is a
   * spreadsheet export, and text keeps the endpoint testable with curl.
   */
  router.post('/factories/:factoryId/import/:kind', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const kind = req.params.kind as ImportKind;

    if (!(kind in IMPORTERS)) {
      throw HttpError.badRequest(
        `Unknown import kind "${kind}". Expected one of ${Object.keys(IMPORTERS).join(', ')}.`,
      );
    }

    const body = asObject(req.body);
    const csv = requireString(body, 'csv');
    const filename = optionalString(body, 'filename') ?? `${kind}.csv`;

    const result = IMPORTERS[kind](db, factoryId, csv, filename);
    // Partial success is the normal case: valid rows land, bad ones are
    // reported by line so the file can be corrected rather than re-guessed.
    res.status(result.rowsAccepted > 0 ? 200 : 422).json(result);
  });

  router.get('/factories/:factoryId/imports', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const rows = db.prepare(`
      SELECT id, kind, filename, rows_total, rows_accepted, rows_rejected, errors, imported_at
      FROM import_batches WHERE factory_id = ? ORDER BY id DESC LIMIT 50
    `).all(factoryId) as Row[];

    res.json(rows.map((row) => ({
      id: num(row, 'id'),
      kind: str(row, 'kind'),
      filename: str(row, 'filename'),
      rowsTotal: num(row, 'rows_total'),
      rowsAccepted: num(row, 'rows_accepted'),
      rowsRejected: num(row, 'rows_rejected'),
      errors: JSON.parse(str(row, 'errors')) as Array<{ line: number; message: string }>,
      importedAt: str(row, 'imported_at'),
    })));
  });

  // --- server-side datasets -----------------------------------------------

  /**
   * Generated datasets available on the server.
   *
   * Offered so a large dataset can be loaded without the browser holding a
   * 140MB file and posting it back as JSON.
   */
  router.get('/datasets', (_req, res, next) => {
    listDatasets().then((datasets) => res.json(datasets)).catch(next);
  });

  router.post('/factories/:factoryId/datasets/:name/import', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const name = req.params.name;
    if (!name) throw HttpError.badRequest('Missing dataset name.');
    res.json(importDataset(db, factoryId, name));
  });

  // --- outcomes and the model ---------------------------------------------

  router.get('/factories/:factoryId/outcomes/summary', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const rows = db.prepare(`
      SELECT r.label AS role_label, o.outcome, COUNT(*) AS n
      FROM outcomes o JOIN roles r ON r.id = o.role_id
      WHERE o.factory_id = ? GROUP BY r.label, o.outcome ORDER BY n DESC
    `).all(factoryId) as Row[];

    res.json(rows.map((row) => ({
      roleLabel: str(row, 'role_label'),
      outcome: str(row, 'outcome'),
      count: num(row, 'n'),
    })));
  });

  /** Which outcome to model. Two targets are supported; see the train route. */
  const requireTarget = (raw: unknown): Target => {
    if (raw === undefined || raw === null || raw === '') return 'displacement';
    if (raw === 'displacement' || raw === 'retraining_success') return raw;
    throw HttpError.badRequest(
      `Unknown target "${String(raw)}". Expected "displacement" or "retraining_success".`,
      { target: 'invalid' },
    );
  };

  router.get('/factories/:factoryId/model', (req, res) => {
    res.json(getStatus(db, requireFactory(req.params.factoryId), requireTarget(req.query['target'])));
  });

  /**
   * Fit a model on this factory's recorded outcomes.
   *
   * Always returns a status. A refusal to train is a legitimate outcome, not an
   * error: too few rows means the honest answer is "keep using the rules".
   */
  router.post('/factories/:factoryId/model/train', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    // Accepted from either the query string or the body, so the endpoint is
    // equally usable from a form and from curl.
    const body = asObject(req.body ?? {});
    const target = requireTarget(req.query['target'] ?? body['target']);
    res.status(200).json(trainForFactory(db, factoryId, target));
  });

  return router;
}
