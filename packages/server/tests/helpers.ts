import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { seed } from '../src/db/seed/index.ts';
import { addMonths } from '../src/lib/dates.ts';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'db', 'migrations');

/** A fixed date, so every test result is reproducible regardless of when it runs. */
export const FIXTURE_AS_OF = '2026-09-04';

/**
 * A migrated, reference-seeded, in-memory database.
 *
 * Applies every migration in the directory rather than a named one, so a new
 * migration reaches the tests without anybody having to remember to add it here.
 * Contains no factories: tests that need one build it explicitly, which keeps
 * every fixture visible in the test that depends on it.
 */
export function makeTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }

  seed(db);
  return db;
}

export interface FixtureFactory {
  factoryId: number;
}

/**
 * A factory built explicitly by the test that uses it.
 *
 * The demo factory this replaced lived in the seed, which meant the golden
 * snapshot depended on data the product shipped. Building the fixture here
 * keeps the expected output and the input that produced it in one file.
 */
export function makeFixtureFactory(db: DatabaseSync, asOfDate: string = FIXTURE_AS_OF): FixtureFactory {
  const factoryId = Number(
    db.prepare("INSERT INTO factories (name, location, product_mix, is_demo) VALUES (?, ?, ?, 0)")
      .run('Fixture Apparel', 'Test', 'Woven').lastInsertRowid,
  );

  const roleId = (slug: string): number => {
    const row = db.prepare('SELECT id FROM roles WHERE slug = ?').get(slug) as { id: number } | undefined;
    if (!row) throw new Error(`fixture: unknown role ${slug}`);
    return row.id;
  };
  const machineId = (slug: string): number => {
    const row = db.prepare('SELECT id FROM machine_types WHERE slug = ?').get(slug) as { id: number } | undefined;
    if (!row) throw new Error(`fixture: unknown machine ${slug}`);
    return row.id;
  };

  const headcounts: Array<[string, number]> = [
    ['sewing-machine-operator', 1420],
    ['finishing-ironing-staff', 540],
    ['packing-staff', 480],
    ['cutting-machine-operator', 260],
    ['fabric-spreader', 95],
  ];
  const insertHeadcount = db.prepare(
    'INSERT INTO role_headcounts (factory_id, role_id, headcount) VALUES (?, ?, ?)',
  );
  for (const [slug, headcount] of headcounts) insertHeadcount.run(factoryId, roleId(slug), headcount);

  // Spaced so the fixture exercises all three schedule states.
  const plans: Array<[string, string, string, number]> = [
    ['Tunnel finisher', 'tunnel-finisher', 'finishing-ironing-staff', 1],
    ['Automated carton packing line', 'automated-packing-line', 'packing-staff', 1],
    ['Automated laser cutter', 'automated-laser-cutter', 'cutting-machine-operator', 2],
    ['Semi-automated sewing units', 'automated-sewing-unit', 'sewing-machine-operator', 8],
  ];
  const monthsOut = [1, 2, 3, 9];
  const insertPlan = db.prepare(`
    INSERT INTO machinery_plans (factory_id, machine_type_id, machine_name, affected_role_id, arrival_date, units)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  plans.forEach(([name, machineSlug, roleSlug, units], i) => {
    insertPlan.run(factoryId, machineId(machineSlug), name, roleId(roleSlug),
      addMonths(asOfDate, monthsOut[i]!), units);
  });

  return { factoryId };
}
