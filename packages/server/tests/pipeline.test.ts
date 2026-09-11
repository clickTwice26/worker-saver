import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { makeTestDb } from './helpers.ts';
import { createApp } from '../src/app.ts';

async function withServer(t: TestContext) {
  const db = makeTestDb();
  const app = createApp(db);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('No port assigned');
  const base = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });

  return async (path: string, init?: RequestInit) => {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

test('a fresh install has reference data but no factories', async (t) => {
  const call = await withServer(t);

  const factories = await call('/api/factories');
  assert.deepEqual(factories.body, [], 'no invented customer data ships with the product');

  const roles = await call('/api/roles');
  assert.equal(roles.body.length, 16, 'the knowledge base does ship');
});

test('a factory is created, then a roster is imported from CSV', async (t) => {
  const call = await withServer(t);

  const created = await call('/api/factories', post({ name: 'Real Mills', location: 'Dhaka' }));
  assert.equal(created.status, 201);
  const id = created.body.id;

  const csv = [
    'role,workers',
    'Sewing Machine Operators,1200',
    '"Finishing & Ironing Staff",480',
    'Cutting Machine Operator,210',
  ].join('\n');

  const imported = await call(`/api/factories/${id}/import/roster`, post({ csv, filename: 'roster.csv' }));
  assert.equal(imported.status, 200);
  assert.equal(imported.body.rowsAccepted, 3);
  assert.equal(imported.body.rowsRejected, 0);

  const roster = await call(`/api/factories/${id}/headcounts`);
  assert.equal(roster.body.reduce((s: number, h: any) => s + h.headcount, 0), 1890);
});

test('bad rows are reported by line while good rows still land', async (t) => {
  const call = await withServer(t);
  const id = (await call('/api/factories', post({ name: 'Partial' }))).body.id;

  const csv = [
    'role,workers',
    'Sewing Machine Operators,1200',
    'Astronaut,50',
    'Packing Staff,not-a-number',
  ].join('\n');

  const result = await call(`/api/factories/${id}/import/roster`, post({ csv }));
  assert.equal(result.body.rowsAccepted, 1);
  assert.equal(result.body.rowsRejected, 2);
  // Line numbers count the header, so they match what a spreadsheet shows.
  assert.equal(result.body.errors[0].line, 3);
  assert.match(result.body.errors[0].message, /Unknown role "Astronaut"/);
  assert.equal(result.body.errors[1].line, 4);
});

/** The product refuses to store worker names, and says why. */
test('a worker import carrying names is rejected', async (t) => {
  const call = await withServer(t);
  const id = (await call('/api/factories', post({ name: 'Named' }))).body.id;

  const csv = 'worker_ref,name,role\nA-1,Rahim Uddin,Sewing Machine Operators\n';
  const result = await call(`/api/factories/${id}/import/workers`, post({ csv }));

  assert.equal(result.body.rowsAccepted, 0);
  assert.match(result.body.errors[0].message, /pseudonymous/);
});

test('machinery import derives the affected role from the catalogue', async (t) => {
  const call = await withServer(t);
  const id = (await call('/api/factories', post({ name: 'Machines' }))).body.id;
  await call(`/api/factories/${id}/import/roster`, post({ csv: 'role,workers\nCutting Machine Operators,200\n' }));

  const csv = 'machine_type,arrival_date,units\nautomated-laser-cutter,2027-03-01,2\n';
  const result = await call(`/api/factories/${id}/import/machinery`, post({ csv }));
  assert.equal(result.body.rowsAccepted, 1);

  const plans = await call(`/api/factories/${id}/machinery-plans`);
  assert.equal(plans.body[0].affectedRoleSlug, 'cutting-machine-operator');
  assert.equal(plans.body[0].headcountDisplacedPerUnit, null, 'derived, not typed in');
});

test('with no outcomes the model reports no data and the rules govern', async (t) => {
  const call = await withServer(t);
  const id = (await call('/api/factories', post({ name: 'Cold Start' }))).body.id;

  const status = await call(`/api/factories/${id}/model`);
  assert.equal(status.body.status, 'no_data');
  assert.equal(status.body.model, null);
  assert.match(status.body.message, /rule engine/);
});

test('training refuses on too few outcomes rather than fitting', async (t) => {
  const call = await withServer(t);
  const id = (await call('/api/factories', post({ name: 'Thin' }))).body.id;

  const rows = ['worker_ref,role,arrival_date,outcome'];
  for (let i = 0; i < 10; i += 1) {
    rows.push(`W-${i},Sewing Machine Operators,2026-01-01,${i % 2 === 0 ? 'displaced' : 'retained'}`);
  }
  // Distinct dates, since (factory, worker, arrival) is unique.
  const csv = rows.map((r, i) => (i === 0 ? r : r.replace('2026-01-01', `2026-01-${String(i).padStart(2, '0')}`))).join('\n');

  const imported = await call(`/api/factories/${id}/import/outcomes`, post({ csv }));
  assert.equal(imported.body.rowsAccepted, 10);

  const trained = await call(`/api/factories/${id}/model/train`, post({}));
  assert.equal(trained.body.status, 'insufficient_data');
  assert.equal(trained.body.model, null);
  assert.match(trained.body.message, /at least/);
});

/**
 * The full loop: import outcomes carrying real signal, train, and confirm the
 * model is activated and starts producing the scores.
 */
test('enough outcomes with signal train a model that takes over scoring', async (t) => {
  const call = await withServer(t);
  const id = (await call('/api/factories', post({ name: 'Learning Mills' }))).body.id;

  await call(`/api/factories/${id}/import/roster`, post({
    csv: 'role,workers\nSewing Machine Operators,400\nCutting Machine Operators,120\n',
  }));

  // Signal: short tenure and few known operations displace; long tenure and
  // multi-skilling do not. The model has to recover that from the rows alone.
  const rows = ['worker_ref,role,arrival_date,outcome,tenure_months,operations_known,skill_grade'];
  for (let i = 0; i < 120; i += 1) {
    const displaced = i % 2 === 0;
    const tenure = displaced ? 4 + (i % 5) : 90 + (i % 30);
    const ops = displaced ? 1 : 4;
    const grade = displaced ? 'entry' : 'skilled';
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    rows.push(
      `W-${i},Sewing Machine Operators,2025-${month}-${day},` +
      `${displaced ? 'displaced' : 'retained'},${tenure},${ops},${grade}`,
    );
  }

  const imported = await call(`/api/factories/${id}/import/outcomes`, post({ csv: rows.join('\n') }));
  assert.ok(imported.body.rowsAccepted >= 100, `imported ${imported.body.rowsAccepted}`);

  const trained = await call(`/api/factories/${id}/model/train`, post({}));
  assert.equal(trained.body.status, 'active', trained.body.message);
  assert.ok(trained.body.model.auc > 0.9, `cross-validated AUC ${trained.body.model.auc}`);
  assert.equal(trained.body.model.beatsBaseline, true);
  assert.ok(trained.body.influence.length > 0, 'feature influence is reported');

  // And the analysis now attributes its scores to the model.
  await call(`/api/factories/${id}/import/machinery`, post({
    csv: 'machine_type,arrival_date,units\nautomated-sewing-unit,2027-06-01,6\n',
  }));
  await call(`/api/factories/${id}/run-analysis`, post({}));

  const plan = await call(`/api/factories/${id}/plan`);
  assert.ok(plan.body.findings.length > 0);
  assert.equal(plan.body.findings[0].scoreSource, 'model');
});

test('the import history records every batch with its rejects', async (t) => {
  const call = await withServer(t);
  const id = (await call('/api/factories', post({ name: 'History' }))).body.id;

  await call(`/api/factories/${id}/import/roster`, post({ csv: 'role,workers\nPacking Staff,100\nNope,5\n', filename: 'a.csv' }));

  const history = await call(`/api/factories/${id}/imports`);
  assert.equal(history.body.length, 1);
  assert.equal(history.body[0].filename, 'a.csv');
  assert.equal(history.body[0].rowsAccepted, 1);
  assert.equal(history.body[0].rowsRejected, 1);
  assert.equal(history.body[0].errors.length, 1);
});
