import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTestDb } from './helpers.ts';
import { listRoles, resolveRoleId } from '../src/repositories/reference.ts';
import { normaliseRoleName } from '../src/lib/text.ts';

/**
 * The defect these tests exist for.
 *
 * The v1 specification seeded risk rules under "Cutting Machine Operators" while
 * the worker and machinery tables used "Cutting Machine Operator", and matched
 * the two with exact string equality. Its first run would have returned nothing.
 */
test('singular and plural role names resolve to the same role', () => {
  const db = makeTestDb();
  const singular = resolveRoleId(db, 'Cutting Machine Operator');
  const plural = resolveRoleId(db, 'Cutting Machine Operators');

  assert.ok(singular, 'singular form should resolve');
  assert.equal(singular, plural, 'both spellings must reach one role');
  db.close();
});

test('role resolution ignores case, punctuation and ampersands', () => {
  const db = makeTestDb();
  const canonical = resolveRoleId(db, 'Finishing & Ironing Staff');

  assert.ok(canonical);
  assert.equal(resolveRoleId(db, 'finishing and ironing staff'), canonical);
  assert.equal(resolveRoleId(db, '  FINISHING  &  IRONING  STAFF  '), canonical);
  db.close();
});

test('an unknown role resolves to null rather than a wrong match', () => {
  const db = makeTestDb();
  assert.equal(resolveRoleId(db, 'Chief Executive Officer'), null);
  db.close();
});

test('every seeded role carries a label, a department and synonyms', () => {
  const db = makeTestDb();
  const roles = listRoles(db);

  assert.equal(roles.length, 16);
  for (const role of roles) {
    assert.ok(role.label.length > 0, `${role.slug} needs a label`);
    assert.ok(role.synonyms.length > 0, `${role.slug} needs at least one synonym`);
    assert.ok(role.department.length > 0, `${role.slug} needs a department`);
  }
  db.close();
});

test('normaliseRoleName collapses the variations that appear in the source documents', () => {
  assert.equal(normaliseRoleName('Fabric & Pattern Cutters'), 'fabric and pattern cutters');
  assert.equal(normaliseRoleName('  Line-Supervisor  '), 'line supervisor');
});
