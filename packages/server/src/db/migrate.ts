import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from './index.ts';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Apply every migration the database has not seen yet, in filename order.
 * Each one runs in a transaction, so a failure leaves the schema untouched.
 */
export function migrate(db: DatabaseSync): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((r) => String(r['name'])),
  );

  const pending = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const ran: string[] = [];

  for (const name of pending) {
    if (applied.has(name)) continue;

    const sql = readFileSync(join(migrationsDir, name), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
        .run(name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${name} failed: ${(error as Error).message}`);
    }
    ran.push(name);
  }

  return ran;
}

if (import.meta.filename === process.argv[1]) {
  const ran = migrate(getDb());
  console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'Already up to date.');
}
