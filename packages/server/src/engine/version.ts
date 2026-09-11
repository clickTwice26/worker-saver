import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

/**
 * Bumped by hand whenever the scheduling arithmetic changes.
 * Recorded on every run, so an old report can be re-derived with the logic
 * that originally produced it.
 */
export const ENGINE_VERSION = '1.0.0';

/**
 * A content hash of the risk knowledge base.
 *
 * Derived rather than hand-maintained: editing any score, band or rationale
 * changes this string, which makes "the rules changed underneath us" visible in
 * the run history instead of invisible.
 */
export function computeRulesVersion(db: DatabaseSync): string {
  const rows = db.prepare(`
    SELECT r.slug, k.machine_trigger, k.base_score, k.band, k.confidence
    FROM risk_rules k JOIN roles r ON r.id = k.role_id
    ORDER BY r.slug, k.machine_trigger
  `).all();

  const canonical = rows
    .map((r) => `${r['slug']}|${r['machine_trigger']}|${r['base_score']}|${r['band']}|${r['confidence']}`)
    .join('\n');

  return `rules-${createHash('sha256').update(canonical).digest('hex').slice(0, 12)}`;
}
