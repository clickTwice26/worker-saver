import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { HttpError } from '../lib/http.ts';
import {
  asObject, optionalInteger, optionalString, parseId,
  requireInteger, requireIsoDate, requireString,
} from '../lib/validate.ts';
import * as reference from '../repositories/reference.ts';
import * as factoryRepo from '../repositories/factory.ts';

/** Factory inputs: the role roster and the machine roadmap. */
export function factoryRoutes(db: DatabaseSync): Router {
  const router = Router();

  const requireFactory = (raw: string | undefined): number => {
    const id = parseId(raw, 'factoryId');
    if (!factoryRepo.getFactory(db, id)) throw HttpError.notFound(`No factory with id ${id}.`);
    return id;
  };

  /**
   * Resolve a role from either an explicit id or free text.
   *
   * Accepting a name is what makes the synonym table useful: a factory pasting
   * "Cutting Machine Operators" from its own spreadsheet lands on the same role
   * as the singular form used elsewhere in the original specification.
   */
  const resolveRole = (body: Record<string, unknown>, textField: string): number => {
    const explicit = optionalInteger(body, 'roleId', 0, { min: 1 });
    if (explicit) {
      if (!reference.roleExists(db, explicit)) throw HttpError.notFound(`No role with id ${explicit}.`);
      return explicit;
    }
    const name = optionalString(body, textField);
    if (!name) {
      throw HttpError.badRequest(`Supply either "roleId" or "${textField}".`, { roleId: 'required' });
    }
    const resolved = reference.resolveRoleId(db, name);
    if (!resolved) throw HttpError.roleNotResolved(name);
    return resolved;
  };

  router.get('/factories/:factoryId/headcounts', (req, res) => {
    res.json(factoryRepo.listHeadcounts(db, requireFactory(req.params.factoryId)));
  });

  router.put('/factories/:factoryId/headcounts', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const body = asObject(req.body);
    const roleId = resolveRole(body, 'role');
    const headcount = requireInteger(body, 'headcount', { min: 0, max: 1_000_000 });

    factoryRepo.upsertHeadcount(db, factoryId, roleId, headcount);
    res.status(200).json(factoryRepo.listHeadcounts(db, factoryId));
  });

  router.delete('/factories/:factoryId/headcounts/:roleId', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const roleId = parseId(req.params.roleId, 'roleId');
    if (!factoryRepo.deleteHeadcount(db, factoryId, roleId)) {
      throw HttpError.notFound(`No headcount recorded for role ${roleId}.`);
    }
    res.status(204).end();
  });

  router.get('/factories/:factoryId/machinery-plans', (req, res) => {
    res.json(factoryRepo.listMachineryPlans(db, requireFactory(req.params.factoryId)));
  });

  router.post('/factories/:factoryId/machinery-plans', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const body = asObject(req.body);

    // Naming a catalogue machine is what lets the engine derive displacement.
    // Omitting it is allowed, but then the caller has to supply the figure.
    const machineTypeSlug = optionalString(body, 'machineType');
    const machineTypeId = machineTypeSlug === undefined
      ? null
      : reference.machineTypeIdBySlug(db, machineTypeSlug);

    if (machineTypeSlug !== undefined && machineTypeId === null) {
      throw HttpError.badRequest(
        `No machine type matches "${machineTypeSlug}". Use a slug from GET /api/machine-types.`,
        { machineType: 'unknown' },
      );
    }

    const override = optionalInteger(body, 'headcountDisplacedPerUnit', -1, { min: 0, max: 100_000 });
    if (machineTypeId === null && override < 0) {
      throw HttpError.badRequest(
        'Supply either "machineType" (so displacement can be derived from the catalogue) ' +
        'or "headcountDisplacedPerUnit".',
        { machineType: 'required' },
      );
    }

    const id = factoryRepo.insertMachineryPlan(db, {
      factoryId,
      machineName: requireString(body, 'machineName'),
      machineTypeId,
      affectedRoleId: resolveRole(body, 'affectedRole'),
      arrivalDate: requireIsoDate(body, 'arrivalDate'),
      units: optionalInteger(body, 'units', 1, { min: 1, max: 10_000 }),
      headcountDisplacedPerUnit: override < 0 ? null : override,
    });

    const created = factoryRepo.listMachineryPlans(db, factoryId).find((p) => p.id === id);
    res.status(201).json(created);
  });

  router.delete('/factories/:factoryId/machinery-plans/:planId', (req, res) => {
    const factoryId = requireFactory(req.params.factoryId);
    const planId = parseId(req.params.planId, 'planId');
    if (!factoryRepo.deleteMachineryPlan(db, factoryId, planId)) {
      throw HttpError.notFound(`No machinery plan with id ${planId}.`);
    }
    res.status(204).end();
  });

  return router;
}
