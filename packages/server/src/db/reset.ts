import { rmSync } from 'node:fs';
import { config } from '../config.ts';
import { getDb } from './index.ts';
import { migrate } from './migrate.ts';
import { seed } from './seed/index.ts';

/** Drop the database file and rebuild it from migrations + seed data. */
for (const suffix of ['', '-wal', '-shm']) {
  rmSync(`${config.databasePath}${suffix}`, { force: true });
}

const db = getDb();
const ran = migrate(db);
console.log(`Migrated: ${ran.join(', ')}`);

const summary = seed(db);
console.log(
  `Reference data: ${summary.roles} roles, ${summary.synonyms} synonyms, ` +
  `${summary.operations} operations,\n` +
  `                ${summary.riskRules} risk rules, ${summary.machineTypes} machine types, ` +
  `${summary.trainingPrograms} training programmes, ${summary.wageBands} wage bands.`,
);
console.log('No factories seeded — create one and import your roster.');
console.log(`Database ready at ${config.databasePath}`);
