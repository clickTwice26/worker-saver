import type { DatabaseSync } from 'node:sqlite';
import { getDb, transaction } from '../index.ts';
import { normaliseRoleName } from '../../lib/text.ts';

import { roles } from './roles.ts';
import { riskRules } from './risk-rules.ts';
import { trainingPrograms } from './training-programs.ts';
import { operations } from './operations.ts';
import { machineTypes } from './machines.ts';
import { wageBands } from './wages.ts';

export interface SeedSummary {
  roles: number;
  synonyms: number;
  riskRules: number;
  trainingPrograms: number;
  operations: number;
  machineTypes: number;
  wageBands: number;
}

/**
 * Load reference data only: the role taxonomy, the operations catalogue, the
 * risk knowledge base, the machine catalogue, the training catalogue and the
 * wage bands.
 *
 * There are deliberately no factories here. Reference data is a knowledge base
 * that ships with the product; a roster and a machine roadmap belong to a real
 * customer and arrive by import. A seeded "demo factory" would put invented
 * numbers where a user expects their own.
 *
 * Idempotent: every insert is an upsert keyed on a natural key, so running the
 * seed twice leaves the database in the same state rather than duplicating it.
 */
export function seed(db: DatabaseSync): SeedSummary {
  return transaction(db, () => {
    const summary: SeedSummary = {
      roles: 0, synonyms: 0, riskRules: 0, trainingPrograms: 0,
      operations: 0, machineTypes: 0, wageBands: 0,
    };

    // --- roles and synonyms ------------------------------------------------
    const insertRole = db.prepare(`
      INSERT INTO roles (slug, label, department, sort_order) VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET label = excluded.label,
                                      department = excluded.department,
                                      sort_order = excluded.sort_order
    `);
    const insertSynonym = db.prepare(
      'INSERT OR IGNORE INTO role_synonyms (role_id, synonym) VALUES (?, ?)',
    );

    roles.forEach((role, index) => {
      insertRole.run(role.slug, role.label, role.department, index);
      summary.roles += 1;

      const roleId = roleIdBySlug(db, role.slug);
      // The canonical labels and the slug are always accepted, alongside the
      // explicit synonym list.
      for (const form of new Set([role.slug, role.label, ...role.synonyms])) {
        insertSynonym.run(roleId, normaliseRoleName(form));
        summary.synonyms += 1;
      }
    });

    // --- risk rules --------------------------------------------------------
    const insertRule = db.prepare(`
      INSERT INTO risk_rules (role_id, machine_trigger, base_score, band, rationale, source_ref, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(role_id, machine_trigger) DO UPDATE SET
        base_score = excluded.base_score, band = excluded.band,
        rationale = excluded.rationale, source_ref = excluded.source_ref,
        confidence = excluded.confidence
    `);
    for (const rule of riskRules) {
      insertRule.run(
        roleIdBySlug(db, rule.roleSlug), rule.machineTrigger, rule.baseScore,
        rule.band, rule.rationale, rule.sourceRef, rule.confidence,
      );
      summary.riskRules += 1;
    }

    // --- training programmes -----------------------------------------------
    const findProgram = db.prepare('SELECT id FROM training_programs WHERE name = ?');
    const insertProgram = db.prepare(`
      INSERT INTO training_programs
        (name, target_role_id, duration_weeks, seats_per_month, cost_per_seat_bdt, provider)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const updateProgram = db.prepare(`
      UPDATE training_programs SET target_role_id = ?, duration_weeks = ?, seats_per_month = ?,
        cost_per_seat_bdt = ?, provider = ? WHERE id = ?
    `);
    for (const program of trainingPrograms) {
      const roleId = roleIdBySlug(db, program.targetRoleSlug);
      const existing = findProgram.get(program.name) as { id: number } | undefined;
      if (existing) {
        updateProgram.run(roleId, program.durationWeeks, program.seatsPerMonth,
          program.costPerSeatBdt, program.provider, existing.id);
      } else {
        insertProgram.run(program.name, roleId, program.durationWeeks,
          program.seatsPerMonth, program.costPerSeatBdt, program.provider);
      }
      summary.trainingPrograms += 1;
    }

    // --- operations --------------------------------------------------------
    const insertOperation = db.prepare(`
      INSERT INTO operations (code, name, role_id, automatability, skill_level) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, role_id = excluded.role_id,
        automatability = excluded.automatability, skill_level = excluded.skill_level
    `);
    for (const operation of operations) {
      insertOperation.run(operation.code, operation.name, roleIdBySlug(db, operation.roleSlug),
        operation.automatability, operation.skillLevel);
      summary.operations += 1;
    }

    // --- machine catalogue -------------------------------------------------
    const insertMachine = db.prepare(`
      INSERT INTO machine_types (
        slug, name, category, automation_level, capital_cost_bdt, install_lead_weeks,
        operators_required, operator_skill_level, maintenance_hours_per_month,
        throughput_workers_equivalent, health_safety_note, notes, source_ref, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name, category = excluded.category,
        automation_level = excluded.automation_level, capital_cost_bdt = excluded.capital_cost_bdt,
        install_lead_weeks = excluded.install_lead_weeks, operators_required = excluded.operators_required,
        operator_skill_level = excluded.operator_skill_level,
        maintenance_hours_per_month = excluded.maintenance_hours_per_month,
        throughput_workers_equivalent = excluded.throughput_workers_equivalent,
        health_safety_note = excluded.health_safety_note, notes = excluded.notes,
        source_ref = excluded.source_ref, confidence = excluded.confidence
    `);
    const insertMachineOperation = db.prepare(`
      INSERT INTO machine_operations (machine_type_id, operation_id, coverage) VALUES (?, ?, ?)
      ON CONFLICT(machine_type_id, operation_id) DO UPDATE SET coverage = excluded.coverage
    `);
    const insertImpact = db.prepare(`
      INSERT INTO machine_role_impact
        (machine_type_id, role_id, workers_displaced_per_unit, workers_created_per_unit, rationale)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(machine_type_id, role_id) DO UPDATE SET
        workers_displaced_per_unit = excluded.workers_displaced_per_unit,
        workers_created_per_unit = excluded.workers_created_per_unit,
        rationale = excluded.rationale
    `);
    const operationIdByCode = db.prepare('SELECT id FROM operations WHERE code = ?');
    const machineIdBySlug = db.prepare('SELECT id FROM machine_types WHERE slug = ?');

    for (const machine of machineTypes) {
      insertMachine.run(
        machine.slug, machine.name, machine.category, machine.automationLevel,
        machine.capitalCostBdt, machine.installLeadWeeks, machine.operatorsRequired,
        machine.operatorSkillLevel, machine.maintenanceHoursPerMonth,
        machine.throughputWorkersEquivalent, machine.healthSafetyNote ?? null,
        machine.notes, machine.sourceRef, machine.confidence,
      );
      summary.machineTypes += 1;

      const machineRow = machineIdBySlug.get(machine.slug) as { id: number } | undefined;
      if (!machineRow) throw new Error(`Seed error: machine "${machine.slug}" vanished after insert`);

      for (const link of machine.operations) {
        const op = operationIdByCode.get(link.code) as { id: number } | undefined;
        if (!op) throw new Error(`Seed error: unknown operation code "${link.code}"`);
        insertMachineOperation.run(machineRow.id, op.id, link.coverage);
      }

      for (const impact of machine.impact) {
        insertImpact.run(machineRow.id, roleIdBySlug(db, impact.roleSlug),
          impact.displacedPerUnit ?? 0, impact.createdPerUnit ?? 0, impact.rationale);
      }
    }

    // --- wage bands --------------------------------------------------------
    const insertWage = db.prepare(`
      INSERT INTO wage_bands (role_id, monthly_cost_bdt, source_ref, confidence) VALUES (?, ?, ?, ?)
      ON CONFLICT(role_id) DO UPDATE SET monthly_cost_bdt = excluded.monthly_cost_bdt,
        source_ref = excluded.source_ref, confidence = excluded.confidence
    `);
    for (const band of wageBands) {
      insertWage.run(roleIdBySlug(db, band.roleSlug), band.monthlyCostBdt, band.sourceRef, band.confidence);
      summary.wageBands += 1;
    }

    return summary;
  });
}

function roleIdBySlug(db: DatabaseSync, slug: string): number {
  const row = db.prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: number } | undefined;
  if (!row) throw new Error(`Seed error: unknown role slug "${slug}"`);
  return row.id;
}

if (import.meta.filename === process.argv[1]) {
  console.log(JSON.stringify(seed(getDb()), null, 2));
}
