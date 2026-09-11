import type { DatabaseSync } from 'node:sqlite';
import type { Factory, MachineryPlan, RoleHeadcount } from '@ale/shared';
import { bool, num, str, type Row } from './row.ts';

/** Selects the factory columns plus its roster size in one pass. */
const FACTORY_COLUMNS = `
  f.id, f.name, f.location, f.product_mix, f.is_demo,
  COALESCE((SELECT SUM(h.headcount) FROM role_headcounts h WHERE h.factory_id = f.id), 0) AS workforce_size
`;

export function listFactories(db: DatabaseSync): Factory[] {
  const rows = db.prepare(`SELECT ${FACTORY_COLUMNS} FROM factories f ORDER BY f.id`).all() as Row[];
  return rows.map(toFactory);
}

export function getFactory(db: DatabaseSync, id: number): Factory | null {
  const row = db.prepare(`SELECT ${FACTORY_COLUMNS} FROM factories f WHERE f.id = ?`)
    .get(id) as Row | undefined;
  return row ? toFactory(row) : null;
}

function toFactory(row: Row): Factory {
  return {
    id: num(row, 'id'),
    name: str(row, 'name'),
    location: str(row, 'location'),
    productMix: str(row, 'product_mix'),
    isDemo: bool(row, 'is_demo'),
    workforceSize: num(row, 'workforce_size'),
  };
}

export function listHeadcounts(db: DatabaseSync, factoryId: number): RoleHeadcount[] {
  const rows = db.prepare(`
    SELECT h.factory_id, h.role_id, h.headcount, r.slug, r.label
    FROM role_headcounts h JOIN roles r ON r.id = h.role_id
    WHERE h.factory_id = ? ORDER BY h.headcount DESC, r.sort_order
  `).all(factoryId) as Row[];

  return rows.map((row) => ({
    factoryId: num(row, 'factory_id'),
    roleId: num(row, 'role_id'),
    roleSlug: str(row, 'slug'),
    roleLabel: str(row, 'label'),
    headcount: num(row, 'headcount'),
  }));
}

/** Insert or replace one role's headcount for a factory. */
export function upsertHeadcount(
  db: DatabaseSync, factoryId: number, roleId: number, headcount: number,
): void {
  db.prepare(`
    INSERT INTO role_headcounts (factory_id, role_id, headcount) VALUES (?, ?, ?)
    ON CONFLICT(factory_id, role_id) DO UPDATE SET headcount = excluded.headcount
  `).run(factoryId, roleId, headcount);
}

export function deleteHeadcount(db: DatabaseSync, factoryId: number, roleId: number): boolean {
  const result = db.prepare('DELETE FROM role_headcounts WHERE factory_id = ? AND role_id = ?')
    .run(factoryId, roleId);
  return Number(result.changes) > 0;
}

export function listMachineryPlans(db: DatabaseSync, factoryId: number): MachineryPlan[] {
  const rows = db.prepare(`
    SELECT m.id, m.factory_id, m.machine_name, m.machine_type_id, mt.slug AS machine_slug,
           m.affected_role_id, r.slug AS role_slug,
           m.arrival_date, m.units, m.headcount_displaced_per_unit
    FROM machinery_plans m
    JOIN roles r ON r.id = m.affected_role_id
    LEFT JOIN machine_types mt ON mt.id = m.machine_type_id
    WHERE m.factory_id = ? ORDER BY m.arrival_date, m.id
  `).all(factoryId) as Row[];

  return rows.map((row) => ({
    id: num(row, 'id'),
    factoryId: num(row, 'factory_id'),
    machineName: str(row, 'machine_name'),
    machineTypeId: row['machine_type_id'] === null ? null : num(row, 'machine_type_id'),
    machineTypeSlug: row['machine_slug'] === null || row['machine_slug'] === undefined
      ? null : str(row, 'machine_slug'),
    affectedRoleId: num(row, 'affected_role_id'),
    affectedRoleSlug: str(row, 'role_slug'),
    arrivalDate: str(row, 'arrival_date'),
    units: num(row, 'units'),
    headcountDisplacedPerUnit: row['headcount_displaced_per_unit'] === null
      ? null : num(row, 'headcount_displaced_per_unit'),
  }));
}

export function insertMachineryPlan(
  db: DatabaseSync,
  input: {
    factoryId: number; machineName: string; machineTypeId: number | null;
    affectedRoleId: number; arrivalDate: string; units: number;
    headcountDisplacedPerUnit: number | null;
  },
): number {
  const result = db.prepare(`
    INSERT INTO machinery_plans
      (factory_id, machine_type_id, machine_name, affected_role_id, arrival_date, units,
       headcount_displaced_per_unit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.factoryId, input.machineTypeId, input.machineName, input.affectedRoleId,
    input.arrivalDate, input.units, input.headcountDisplacedPerUnit,
  );
  return Number(result.lastInsertRowid);
}

export function deleteMachineryPlan(db: DatabaseSync, factoryId: number, planId: number): boolean {
  const result = db.prepare('DELETE FROM machinery_plans WHERE factory_id = ? AND id = ?')
    .run(factoryId, planId);
  return Number(result.changes) > 0;
}
