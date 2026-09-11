/**
 * CSV import.
 *
 * Every importer validates row by row and reports failures with a line number
 * and a reason, rather than rejecting the file wholesale. A factory exporting
 * 3,000 rows from its HR system will have a handful of bad ones, and "row 812:
 * unknown role 'Sewing Opr'" is actionable where "import failed" is not.
 *
 * Valid rows are applied and invalid ones are reported. The alternative —
 * all-or-nothing — means one typo blocks the entire onboarding.
 */

import type { DatabaseSync } from 'node:sqlite';
import { transaction } from '../db/index.ts';
import { parseCsv, field, parseInteger, type RowError } from '../lib/csv.ts';
import { isValidIsoDate } from '../lib/dates.ts';
import * as reference from '../repositories/reference.ts';
import * as factoryRepo from '../repositories/factory.ts';
import { num, type Row } from '../repositories/row.ts';

export type ImportKind = 'roster' | 'machinery' | 'workers' | 'outcomes';

export interface ImportResult {
  batchId: number;
  kind: ImportKind;
  rowsTotal: number;
  rowsAccepted: number;
  rowsRejected: number;
  errors: RowError[];
}

/** Columns each importer accepts, surfaced in the UI so the format is discoverable. */
export const IMPORT_COLUMNS: Record<ImportKind, { required: string[]; optional: string[] }> = {
  roster: { required: ['role', 'workers'], optional: [] },
  machinery: {
    required: ['machine_type', 'arrival_date'],
    optional: ['machine_name', 'role', 'units', 'displaced_per_unit'],
  },
  workers: {
    required: ['worker_ref', 'role'],
    optional: [
      'tenure_months', 'operations_known', 'skill_grade', 'operation', 'line', 'shift',
      'primary_operation_share', 'time_to_competency_weeks', 'prior_trainings',
      'prior_trainings_passed', 'literacy_level', 'digital_comfort',
    ],
  },
  outcomes: {
    required: ['worker_ref', 'role', 'arrival_date', 'outcome'],
    optional: [
      'machine_type', 'tenure_months', 'operations_known', 'skill_grade', 'operation',
      'trained_before_arrival', 'primary_operation_share', 'time_to_competency_weeks',
      'prior_trainings', 'prior_trainings_passed', 'literacy_level', 'digital_comfort',
      'line_ref', 'retraining_result',
    ],
  },
};

const SKILL_GRADES = new Set(['entry', 'semi_skilled', 'skilled', 'specialist']);
const OUTCOMES = new Set(['retained', 'redeployed', 'displaced']);
const RETRAINING = new Set(['passed', 'failed', 'not_enrolled']);
const LITERACY = new Set(['unknown', 'none', 'basic', 'functional', 'fluent']);
const DIGITAL = new Set(['unknown', 'none', 'basic', 'confident']);

/** Decimal columns: shares and week counts are not whole numbers. */
function parseDecimal(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const truthy = (value: string | undefined): boolean =>
  ['1', 'true', 'yes', 'y'].includes((value ?? '').toLowerCase());

function recordBatch(
  db: DatabaseSync, factoryId: number, kind: ImportKind, filename: string,
  total: number, accepted: number, errors: RowError[],
): number {
  return Number(db.prepare(`
    INSERT INTO import_batches
      (factory_id, kind, filename, rows_total, rows_accepted, rows_rejected, errors, imported_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    factoryId, kind, filename, total, accepted, errors.length,
    JSON.stringify(errors.slice(0, 200)), new Date().toISOString(),
  ).lastInsertRowid);
}

/** Headcounts by role. The low-friction input: a handful of rows. */
export function importRoster(
  db: DatabaseSync, factoryId: number, csv: string, filename: string,
): ImportResult {
  const { rows } = parseCsv(csv);
  const errors: RowError[] = [];
  let accepted = 0;

  const batchId = transaction(db, () => {
    rows.forEach((row, index) => {
      const line = index + 2;
      const roleName = field(row, 'role', 'role_name', 'job_role', 'designation');
      const headcount = parseInteger(field(row, 'workers', 'headcount', 'count', 'employees'));

      if (!roleName) { errors.push({ line, message: 'Missing "role".' }); return; }
      if (headcount === null || headcount < 0) {
        errors.push({ line, message: `"workers" must be a whole number, got "${field(row, 'workers') ?? ''}".` });
        return;
      }

      const roleId = reference.resolveRoleId(db, roleName);
      if (roleId === null) {
        errors.push({ line, message: `Unknown role "${roleName}". See GET /api/roles for accepted names.` });
        return;
      }

      factoryRepo.upsertHeadcount(db, factoryId, roleId, headcount);
      accepted += 1;
    });

    return recordBatch(db, factoryId, 'roster', filename, rows.length, accepted, errors);
  });

  return { batchId, kind: 'roster', rowsTotal: rows.length, rowsAccepted: accepted, rowsRejected: errors.length, errors };
}

/** The machine roadmap. Role and displacement come from the catalogue. */
export function importMachinery(
  db: DatabaseSync, factoryId: number, csv: string, filename: string,
): ImportResult {
  const { rows } = parseCsv(csv);
  const errors: RowError[] = [];
  let accepted = 0;

  const batchId = transaction(db, () => {
    rows.forEach((row, index) => {
      const line = index + 2;
      const typeSlug = field(row, 'machine_type', 'machine_slug', 'type');
      const arrivalDate = field(row, 'arrival_date', 'arrival', 'date');

      if (!typeSlug) { errors.push({ line, message: 'Missing "machine_type".' }); return; }
      if (!isValidIsoDate(arrivalDate)) {
        errors.push({ line, message: `"arrival_date" must be YYYY-MM-DD, got "${arrivalDate ?? ''}".` });
        return;
      }

      const machineTypeId = reference.machineTypeIdBySlug(db, typeSlug);
      if (machineTypeId === null) {
        errors.push({ line, message: `Unknown machine_type "${typeSlug}". See GET /api/machine-types.` });
        return;
      }

      // The affected role defaults to whichever the machine hits hardest, so a
      // factory does not have to know the catalogue to use it.
      const roleName = field(row, 'role', 'affected_role');
      let roleId = roleName ? reference.resolveRoleId(db, roleName) : null;
      if (roleName && roleId === null) {
        errors.push({ line, message: `Unknown role "${roleName}".` });
        return;
      }
      if (roleId === null) {
        const primary = db.prepare(`
          SELECT role_id FROM machine_role_impact
          WHERE machine_type_id = ? ORDER BY workers_displaced_per_unit DESC LIMIT 1
        `).get(machineTypeId) as Row | undefined;
        if (!primary) {
          errors.push({ line, message: `"${typeSlug}" has no role impact recorded; supply "role".` });
          return;
        }
        roleId = num(primary, 'role_id');
      }

      const units = parseInteger(field(row, 'units', 'quantity')) ?? 1;
      if (units < 1) { errors.push({ line, message: '"units" must be at least 1.' }); return; }

      const override = parseInteger(field(row, 'displaced_per_unit', 'headcount_displaced_per_unit'));

      factoryRepo.insertMachineryPlan(db, {
        factoryId,
        machineTypeId,
        machineName: field(row, 'machine_name', 'name') ?? typeSlug,
        affectedRoleId: roleId,
        arrivalDate: arrivalDate!,
        units,
        headcountDisplacedPerUnit: override,
      });
      accepted += 1;
    });

    return recordBatch(db, factoryId, 'machinery', filename, rows.length, accepted, errors);
  });

  return { batchId, kind: 'machinery', rowsTotal: rows.length, rowsAccepted: accepted, rowsRejected: errors.length, errors };
}

/** Worker-level records. Pseudonymous: `worker_ref` is an HR id, never a name. */
export function importWorkers(
  db: DatabaseSync, factoryId: number, csv: string, filename: string,
): ImportResult {
  const { rows } = parseCsv(csv);
  const errors: RowError[] = [];
  let accepted = 0;

  const upsert = db.prepare(`
    INSERT INTO workers
      (factory_id, role_id, external_ref, tenure_months, primary_operation_id,
       skill_grade, operations_known, line_ref, shift, literacy_level, digital_comfort,
       primary_operation_share, time_to_competency_weeks, prior_trainings, prior_trainings_passed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(factory_id, external_ref) DO UPDATE SET
      role_id = excluded.role_id, tenure_months = excluded.tenure_months,
      primary_operation_id = excluded.primary_operation_id, skill_grade = excluded.skill_grade,
      operations_known = excluded.operations_known, line_ref = excluded.line_ref,
      shift = excluded.shift, literacy_level = excluded.literacy_level,
      digital_comfort = excluded.digital_comfort,
      primary_operation_share = excluded.primary_operation_share,
      time_to_competency_weeks = excluded.time_to_competency_weeks,
      prior_trainings = excluded.prior_trainings,
      prior_trainings_passed = excluded.prior_trainings_passed
  `);

  const batchId = transaction(db, () => {
    rows.forEach((row, index) => {
      const line = index + 2;
      const ref = field(row, 'worker_ref', 'employee_id', 'hr_id', 'id');
      const roleName = field(row, 'role', 'designation');

      if (!ref) { errors.push({ line, message: 'Missing "worker_ref".' }); return; }
      // Refusing names here is a design decision, not an oversight.
      if (field(row, 'name', 'full_name', 'worker_name')) {
        errors.push({ line, message: 'Remove the name column — this system stores pseudonymous references only.' });
        return;
      }
      if (!roleName) { errors.push({ line, message: 'Missing "role".' }); return; }

      const roleId = reference.resolveRoleId(db, roleName);
      if (roleId === null) { errors.push({ line, message: `Unknown role "${roleName}".` }); return; }

      const grade = (field(row, 'skill_grade', 'grade') ?? 'semi_skilled').toLowerCase().replace(/[\s-]+/g, '_');
      if (!SKILL_GRADES.has(grade)) {
        errors.push({ line, message: `"skill_grade" must be one of ${[...SKILL_GRADES].join(', ')}.` });
        return;
      }

      const operationCode = field(row, 'operation', 'operation_code');
      let operationId: number | null = null;
      if (operationCode) {
        const op = db.prepare('SELECT id FROM operations WHERE code = ?').get(operationCode) as Row | undefined;
        if (!op) { errors.push({ line, message: `Unknown operation "${operationCode}". See GET /api/operations.` }); return; }
        operationId = num(op, 'id');
      }

      const literacy = (field(row, 'literacy_level', 'literacy') ?? 'unknown').toLowerCase();
      const digital = (field(row, 'digital_comfort', 'digital') ?? 'unknown').toLowerCase();
      if (!LITERACY.has(literacy)) { errors.push({ line, message: `"literacy_level" must be one of ${[...LITERACY].join(', ')}.` }); return; }
      if (!DIGITAL.has(digital)) { errors.push({ line, message: `"digital_comfort" must be one of ${[...DIGITAL].join(', ')}.` }); return; }

      const trainings = parseInteger(field(row, 'prior_trainings')) ?? 0;
      const passed = parseInteger(field(row, 'prior_trainings_passed')) ?? 0;
      if (passed > trainings) {
        errors.push({ line, message: '"prior_trainings_passed" cannot exceed "prior_trainings".' });
        return;
      }

      upsert.run(
        factoryId, roleId, ref,
        parseInteger(field(row, 'tenure_months', 'tenure')),
        operationId, grade,
        parseInteger(field(row, 'operations_known', 'skills_count')) ?? 1,
        field(row, 'line', 'line_ref') ?? '',
        field(row, 'shift') ?? '',
        literacy, digital,
        parseDecimal(field(row, 'primary_operation_share')),
        parseDecimal(field(row, 'time_to_competency_weeks')),
        trainings, passed,
      );
      accepted += 1;
    });

    return recordBatch(db, factoryId, 'workers', filename, rows.length, accepted, errors);
  });

  return { batchId, kind: 'workers', rowsTotal: rows.length, rowsAccepted: accepted, rowsRejected: errors.length, errors };
}

/**
 * Recorded outcomes — the only source of training labels.
 *
 * Features are taken from the file rather than from the worker's current record
 * so the row describes the worker as they were at the arrival date. Reading
 * today's values for a decision made two years ago leaks the future into the
 * past and produces a model that validates well and predicts nothing.
 */
export function importOutcomes(
  db: DatabaseSync, factoryId: number, csv: string, filename: string,
): ImportResult {
  const { rows } = parseCsv(csv);
  const errors: RowError[] = [];
  let accepted = 0;

  const batchIdHolder = { id: 0 };

  const insert = db.prepare(`
    INSERT INTO outcomes
      (factory_id, worker_ref, role_id, machine_type_id, arrival_date, outcome,
       tenure_months, operations_known, skill_grade, primary_operation_id,
       trained_before_arrival, recorded_at, import_batch_id,
       primary_operation_share, time_to_competency_weeks, prior_trainings,
       prior_trainings_passed, literacy_level, digital_comfort, line_ref, retraining_result)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(factory_id, worker_ref, arrival_date) DO UPDATE SET
      outcome = excluded.outcome, role_id = excluded.role_id,
      machine_type_id = excluded.machine_type_id, tenure_months = excluded.tenure_months,
      operations_known = excluded.operations_known, skill_grade = excluded.skill_grade,
      primary_operation_id = excluded.primary_operation_id,
      trained_before_arrival = excluded.trained_before_arrival,
      primary_operation_share = excluded.primary_operation_share,
      time_to_competency_weeks = excluded.time_to_competency_weeks,
      prior_trainings = excluded.prior_trainings,
      prior_trainings_passed = excluded.prior_trainings_passed,
      literacy_level = excluded.literacy_level, digital_comfort = excluded.digital_comfort,
      line_ref = excluded.line_ref, retraining_result = excluded.retraining_result
  `);

  transaction(db, () => {
    // The batch row is written first so accepted rows can reference it.
    batchIdHolder.id = recordBatch(db, factoryId, 'outcomes', filename, rows.length, 0, []);
    const recordedAt = new Date().toISOString();

    rows.forEach((row, index) => {
      const line = index + 2;
      const ref = field(row, 'worker_ref', 'employee_id', 'hr_id');
      const roleName = field(row, 'role', 'designation');
      const arrivalDate = field(row, 'arrival_date', 'arrival', 'date');
      const outcome = (field(row, 'outcome', 'result') ?? '').toLowerCase();

      if (!ref) { errors.push({ line, message: 'Missing "worker_ref".' }); return; }
      if (!roleName) { errors.push({ line, message: 'Missing "role".' }); return; }
      if (!isValidIsoDate(arrivalDate)) {
        errors.push({ line, message: `"arrival_date" must be YYYY-MM-DD, got "${arrivalDate ?? ''}".` });
        return;
      }
      if (!OUTCOMES.has(outcome)) {
        errors.push({ line, message: `"outcome" must be one of ${[...OUTCOMES].join(', ')}, got "${outcome}".` });
        return;
      }

      const roleId = reference.resolveRoleId(db, roleName);
      if (roleId === null) { errors.push({ line, message: `Unknown role "${roleName}".` }); return; }

      const typeSlug = field(row, 'machine_type', 'machine_slug');
      const machineTypeId = typeSlug ? reference.machineTypeIdBySlug(db, typeSlug) : null;
      if (typeSlug && machineTypeId === null) {
        errors.push({ line, message: `Unknown machine_type "${typeSlug}".` });
        return;
      }

      const grade = (field(row, 'skill_grade', 'grade') ?? 'semi_skilled').toLowerCase().replace(/[\s-]+/g, '_');
      if (!SKILL_GRADES.has(grade)) {
        errors.push({ line, message: `"skill_grade" must be one of ${[...SKILL_GRADES].join(', ')}.` });
        return;
      }

      const operationCode = field(row, 'operation', 'operation_code');
      let operationId: number | null = null;
      if (operationCode) {
        const op = db.prepare('SELECT id FROM operations WHERE code = ?').get(operationCode) as Row | undefined;
        if (!op) { errors.push({ line, message: `Unknown operation "${operationCode}".` }); return; }
        operationId = num(op, 'id');
      }

      const trained = truthy(field(row, 'trained_before_arrival', 'trained')) ? 1 : 0;

      const literacy = (field(row, 'literacy_level', 'literacy') ?? 'unknown').toLowerCase();
      const digital = (field(row, 'digital_comfort', 'digital') ?? 'unknown').toLowerCase();
      if (!LITERACY.has(literacy)) { errors.push({ line, message: `"literacy_level" must be one of ${[...LITERACY].join(', ')}.` }); return; }
      if (!DIGITAL.has(digital)) { errors.push({ line, message: `"digital_comfort" must be one of ${[...DIGITAL].join(', ')}.` }); return; }

      // The second training label. Absent means nobody was enrolled, which is
      // excluded from that model rather than counted as a failure.
      const retrainingRaw = (field(row, 'retraining_result', 'retraining') ?? '').toLowerCase();
      if (retrainingRaw && !RETRAINING.has(retrainingRaw)) {
        errors.push({ line, message: `"retraining_result" must be one of ${[...RETRAINING].join(', ')}.` });
        return;
      }

      insert.run(
        factoryId, ref, roleId, machineTypeId, arrivalDate!, outcome,
        parseInteger(field(row, 'tenure_months', 'tenure')),
        parseInteger(field(row, 'operations_known', 'skills_count')),
        grade, operationId, trained, recordedAt, batchIdHolder.id,
        parseDecimal(field(row, 'primary_operation_share')),
        parseDecimal(field(row, 'time_to_competency_weeks')),
        parseInteger(field(row, 'prior_trainings')) ?? 0,
        parseInteger(field(row, 'prior_trainings_passed')) ?? 0,
        literacy, digital, field(row, 'line_ref', 'line') ?? '',
        retrainingRaw || null,
      );
      accepted += 1;
    });

    db.prepare('UPDATE import_batches SET rows_accepted = ?, rows_rejected = ?, errors = ? WHERE id = ?')
      .run(accepted, errors.length, JSON.stringify(errors.slice(0, 200)), batchIdHolder.id);
  });

  return {
    batchId: batchIdHolder.id, kind: 'outcomes',
    rowsTotal: rows.length, rowsAccepted: accepted, rowsRejected: errors.length, errors,
  };
}
