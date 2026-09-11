import type { DatabaseSync } from 'node:sqlite';
import type {
  AutomationLevel, Confidence, Department, MachineCategory, MachineType, Operation,
  RiskBand, Role, RiskRule, SkillLevel, TrainingProgram,
} from '@ale/shared';
import { normaliseRoleName } from '../lib/text.ts';
import { enumOf, num, str, type Row } from './row.ts';

const BANDS = ['high', 'moderate', 'low'] as const satisfies readonly RiskBand[];
const CONFIDENCES = ['sourced', 'estimated'] as const satisfies readonly Confidence[];
const DEPARTMENTS = ['cutting', 'sewing', 'finishing', 'support', 'technical'] as const satisfies readonly Department[];

export function listRoles(db: DatabaseSync): Role[] {
  const roleRows = db.prepare(
    'SELECT id, slug, label, department FROM roles ORDER BY sort_order, id',
  ).all() as Row[];

  const synonymRows = db.prepare(
    'SELECT role_id, synonym FROM role_synonyms ORDER BY synonym',
  ).all() as Row[];

  const synonymsByRole = new Map<number, string[]>();
  for (const row of synonymRows) {
    const roleId = num(row, 'role_id');
    const bucket = synonymsByRole.get(roleId);
    if (bucket) bucket.push(str(row, 'synonym'));
    else synonymsByRole.set(roleId, [str(row, 'synonym')]);
  }

  return roleRows.map((row) => {
    const id = num(row, 'id');
    return {
      id,
      slug: str(row, 'slug'),
      label: str(row, 'label'),
      department: enumOf(row, 'department', DEPARTMENTS),
      synonyms: synonymsByRole.get(id) ?? [],
    };
  });
}

/**
 * Resolve free text to a role id via the synonym table.
 *
 * This is the fix for the defect in the v1 specification, where the seed data
 * and the input tables spelled the same role differently and an equality match
 * therefore found nothing.
 */
export function resolveRoleId(db: DatabaseSync, name: string): number | null {
  const row = db.prepare('SELECT role_id FROM role_synonyms WHERE synonym = ?')
    .get(normaliseRoleName(name)) as Row | undefined;
  return row ? num(row, 'role_id') : null;
}

export function roleExists(db: DatabaseSync, roleId: number): boolean {
  return db.prepare('SELECT 1 AS ok FROM roles WHERE id = ?').get(roleId) !== undefined;
}

export function listRiskRules(db: DatabaseSync): RiskRule[] {
  const rows = db.prepare(`
    SELECT k.id, k.role_id, r.slug AS role_slug, k.machine_trigger, k.base_score,
           k.band, k.rationale, k.source_ref, k.confidence
    FROM risk_rules k JOIN roles r ON r.id = k.role_id
    ORDER BY k.base_score DESC, r.slug
  `).all() as Row[];

  return rows.map((row) => ({
    id: num(row, 'id'),
    roleId: num(row, 'role_id'),
    roleSlug: str(row, 'role_slug'),
    machineTrigger: str(row, 'machine_trigger'),
    baseScore: num(row, 'base_score'),
    band: enumOf(row, 'band', BANDS),
    rationale: str(row, 'rationale'),
    sourceRef: str(row, 'source_ref'),
    confidence: enumOf(row, 'confidence', CONFIDENCES),
  }));
}

export function listTrainingPrograms(db: DatabaseSync): TrainingProgram[] {
  const rows = db.prepare(`
    SELECT id, name, target_role_id, duration_weeks, seats_per_month, cost_per_seat_bdt, provider
    FROM training_programs ORDER BY name
  `).all() as Row[];

  return rows.map((row) => ({
    id: num(row, 'id'),
    name: str(row, 'name'),
    targetRoleId: num(row, 'target_role_id'),
    durationWeeks: num(row, 'duration_weeks'),
    seatsPerMonth: num(row, 'seats_per_month'),
    costPerSeatBdt: num(row, 'cost_per_seat_bdt'),
    provider: str(row, 'provider'),
  }));
}

const CATEGORIES = ['cutting', 'sewing', 'finishing', 'printing', 'handling', 'inspection', 'systems'] as const satisfies readonly MachineCategory[];
const AUTOMATION = ['assisted', 'semi_automatic', 'fully_automatic'] as const satisfies readonly AutomationLevel[];
const SKILLS = ['entry', 'semi_skilled', 'skilled', 'specialist'] as const satisfies readonly SkillLevel[];

export function listOperations(db: DatabaseSync): Operation[] {
  const rows = db.prepare(`
    SELECT o.id, o.code, o.name, o.role_id, r.slug AS role_slug, o.automatability, o.skill_level
    FROM operations o JOIN roles r ON r.id = o.role_id
    ORDER BY o.automatability DESC, o.code
  `).all() as Row[];

  return rows.map((row) => ({
    id: num(row, 'id'),
    code: str(row, 'code'),
    name: str(row, 'name'),
    roleId: num(row, 'role_id'),
    roleSlug: str(row, 'role_slug'),
    automatability: num(row, 'automatability'),
    skillLevel: enumOf(row, 'skill_level', SKILLS),
  }));
}

/**
 * The machine catalogue, with its operation coverage and role impact attached.
 *
 * This is the reference data that lets the engine compute displacement instead
 * of asking a factory to estimate it.
 */
export function listMachineTypes(db: DatabaseSync): MachineType[] {
  const machineRows = db.prepare(`
    SELECT id, slug, name, category, automation_level, capital_cost_bdt, install_lead_weeks,
           operators_required, operator_skill_level, maintenance_hours_per_month,
           throughput_workers_equivalent, health_safety_note, notes, source_ref, confidence
    FROM machine_types ORDER BY category, name
  `).all() as Row[];

  const operationRows = db.prepare(`
    SELECT mo.machine_type_id, o.code, o.name, mo.coverage
    FROM machine_operations mo JOIN operations o ON o.id = mo.operation_id
    ORDER BY mo.coverage DESC
  `).all() as Row[];

  const impactRows = db.prepare(`
    SELECT i.machine_type_id, i.role_id, r.slug, r.label,
           i.workers_displaced_per_unit, i.workers_created_per_unit, i.rationale
    FROM machine_role_impact i JOIN roles r ON r.id = i.role_id
    ORDER BY i.workers_displaced_per_unit DESC
  `).all() as Row[];

  const opsByMachine = new Map<number, MachineType['operations']>();
  for (const row of operationRows) {
    const key = num(row, 'machine_type_id');
    const entry = { operationCode: str(row, 'code'), operationName: str(row, 'name'), coverage: num(row, 'coverage') };
    const bucket = opsByMachine.get(key);
    if (bucket) bucket.push(entry);
    else opsByMachine.set(key, [entry]);
  }

  const impactByMachine = new Map<number, MachineType['impact']>();
  for (const row of impactRows) {
    const key = num(row, 'machine_type_id');
    const entry = {
      roleId: num(row, 'role_id'),
      roleSlug: str(row, 'slug'),
      roleLabel: str(row, 'label'),
      displacedPerUnit: num(row, 'workers_displaced_per_unit'),
      createdPerUnit: num(row, 'workers_created_per_unit'),
      rationale: str(row, 'rationale'),
    };
    const bucket = impactByMachine.get(key);
    if (bucket) bucket.push(entry);
    else impactByMachine.set(key, [entry]);
  }

  return machineRows.map((row) => {
    const id = num(row, 'id');
    return {
      id,
      slug: str(row, 'slug'),
      name: str(row, 'name'),
      category: enumOf(row, 'category', CATEGORIES),
      automationLevel: enumOf(row, 'automation_level', AUTOMATION),
      capitalCostBdt: num(row, 'capital_cost_bdt'),
      installLeadWeeks: num(row, 'install_lead_weeks'),
      operatorsRequired: num(row, 'operators_required'),
      operatorSkillLevel: enumOf(row, 'operator_skill_level', SKILLS),
      maintenanceHoursPerMonth: num(row, 'maintenance_hours_per_month'),
      throughputWorkersEquivalent: num(row, 'throughput_workers_equivalent'),
      healthSafetyNote: row['health_safety_note'] === null ? null : str(row, 'health_safety_note'),
      notes: str(row, 'notes'),
      sourceRef: str(row, 'source_ref'),
      confidence: enumOf(row, 'confidence', CONFIDENCES),
      operations: opsByMachine.get(id) ?? [],
      impact: impactByMachine.get(id) ?? [],
    };
  });
}

export function listWageBands(db: DatabaseSync): Array<{ roleId: number; monthlyCostBdt: number }> {
  const rows = db.prepare('SELECT role_id, monthly_cost_bdt FROM wage_bands').all() as Row[];
  return rows.map((row) => ({ roleId: num(row, 'role_id'), monthlyCostBdt: num(row, 'monthly_cost_bdt') }));
}

export function machineTypeIdBySlug(db: DatabaseSync, slug: string): number | null {
  const row = db.prepare('SELECT id FROM machine_types WHERE slug = ?').get(slug) as Row | undefined;
  return row ? num(row, 'id') : null;
}
