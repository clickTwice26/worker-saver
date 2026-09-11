import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.ts';

let instance: DatabaseSync | null = null;

/**
 * Open the database, creating its directory on first use.
 *
 * `node:sqlite` ships with Node, so the project has no native build step and
 * no compiler toolchain requirement — `npm install` is pure JavaScript.
 */
export function getDb(path: string = config.databasePath): DatabaseSync {
  if (instance) return instance;

  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  instance = db;
  return db;
}

/** Open a throwaway in-memory database. Used by the tests. */
export function createMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}

/** Run `fn` inside a transaction, rolling back if it throws. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
