import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { makeTestDb, makeFixtureFactory, FIXTURE_AS_OF } from './helpers.ts';
import { createApp } from '../src/app.ts';

/**
 * Boot the app on an ephemeral port and return a fetch helper.
 *
 * Teardown is registered with the test context rather than returned, so a
 * failing assertion still closes the server. Returning a `close()` for the test
 * to call meant one broken expectation left a listening handle open and the
 * whole run hung with no timeout and no failure message.
 */
async function withServer(t: TestContext): Promise<{
  call: (path: string, init?: RequestInit) => Promise<{ status: number; body: any }>;
  factoryId: number;
}> {
  const db = makeTestDb();
  // No factories ship with the product, so each test builds the one it needs.
  const { factoryId } = makeFixtureFactory(db);
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

  return {
    factoryId,
    call: async (path, init) => {
      const response = await fetch(`${base}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
  };
}

test('GET /api/health reports the engine and rules versions', async (t) => {
  const { call } = await withServer(t);
  const { status, body } = await call('/api/health');

  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.match(body.rulesVersion, /^rules-[0-9a-f]{12}$/);
});

test('every role in the taxonomy has a risk rule and a training programme', async (t) => {
  const { call } = await withServer(t);
  const { body: roles } = await call('/api/roles');
  const { body: rules } = await call('/api/risk-rules');
  const { body: programs } = await call('/api/training-programs');

  const ruledRoles = new Set(rules.map((r: any) => r.roleId));
  const trainedRoles = new Set(programs.map((p: any) => p.targetRoleId));

  for (const role of roles) {
    assert.ok(ruledRoles.has(role.id), `${role.slug} has no risk rule`);
    // Without this, the role could only ever produce a coverage gap.
    assert.ok(trainedRoles.has(role.id), `${role.slug} has no training programme`);
  }
});

test('every risk rule carries its reasoning and its provenance', async (t) => {
  const { call } = await withServer(t);
  const { body: rules } = await call('/api/risk-rules');

  assert.ok(rules.length >= 16);
  for (const rule of rules) {
    assert.ok(rule.rationale.length > 40, `${rule.roleSlug} rationale is too thin to defend`);
    assert.ok(rule.sourceRef.length > 0);
    assert.ok(['sourced', 'estimated'].includes(rule.confidence));
  }
});

test('a machinery plan accepts a role name as free text', async (t) => {
  const { call, factoryId } = await withServer(t);

  // The plural spelling from the seed data, against the singular used elsewhere.
  const { status, body } = await call(`/api/factories/${factoryId}/machinery-plans`, {
    method: 'POST',
    body: JSON.stringify({
      machineName: 'Test cutter',
      machineType: 'automated-laser-cutter',
      affectedRole: 'Cutting Machine Operator',
      arrivalDate: '2027-06-01',
    }),
  });

  assert.equal(status, 201);
  assert.equal(body.affectedRoleSlug, 'cutting-machine-operator');
});

test('an unrecognised role name returns a helpful error, not a silent miss', async (t) => {
  const { call, factoryId } = await withServer(t);
  const { status, body } = await call(`/api/factories/${factoryId}/machinery-plans`, {
    method: 'POST',
    body: JSON.stringify({
      machineName: 'X', machineType: 'automated-laser-cutter',
      affectedRole: 'Astronaut', arrivalDate: '2027-06-01',
    }),
  });

  assert.equal(status, 400);
  assert.equal(body.error.code, 'role_not_resolved');
  assert.match(body.error.message, /GET \/api\/roles/);
});

test('an invalid arrival date is rejected with a field-level error', async (t) => {
  const { call, factoryId } = await withServer(t);
  const { status, body } = await call(`/api/factories/${factoryId}/machinery-plans`, {
    method: 'POST',
    body: JSON.stringify({
      machineName: 'X', machineType: 'automated-laser-cutter', roleId: 1, arrivalDate: '2027-02-30',
    }),
  });

  assert.equal(status, 400);
  assert.equal(body.error.details.arrivalDate, 'invalid_date');
});

test('POST run-analysis then GET plan returns findings with training attached', async (t) => {
  const { call, factoryId } = await withServer(t);

  const run = await call(`/api/factories/${factoryId}/run-analysis`, {
    method: 'POST', body: JSON.stringify({ asOfDate: FIXTURE_AS_OF }),
  });
  assert.equal(run.status, 201);
  assert.ok(run.body.findingCount > 0);

  const { body: plan } = await call(`/api/factories/${factoryId}/plan`);
  assert.ok(plan.findings.length > 0);

  for (const finding of plan.findings) {
    assert.ok(finding.trainingProgramId, 'every finding must carry a training programme');
    assert.ok(finding.trainingProgramName.length > 0);
    assert.ok(finding.rationale.length > 0, 'every score must carry its reasoning');
    assert.ok(finding.sourceRef.length > 0, 'every score must carry its provenance');
  }
});

test('the report exposes commitments, not a ranked risk register', async (t) => {
  const { call, factoryId } = await withServer(t);
  const { status, body } = await call(`/api/factories/${factoryId}/report`);

  assert.equal(status, 200);
  assert.ok(Array.isArray(body.commitments));
  for (const commitment of body.commitments) {
    assert.ok(commitment.trainingProgramName, 'a commitment names the training, not just the risk');
    assert.ok(commitment.startByDate);
    assert.ok(commitment.completesByDate);
  }
  assert.match(body.disclosure, /not a redundancy assessment/);
});

test('an unknown factory returns 404 rather than an empty plan', async (t) => {
  const { call } = await withServer(t);
  const { status, body } = await call('/api/factories/999/plan');

  assert.equal(status, 404);
  assert.equal(body.error.code, 'not_found');
});

test('a negative headcount is rejected', async (t) => {
  const { call, factoryId } = await withServer(t);
  const { status, body } = await call(`/api/factories/${factoryId}/headcounts`, {
    method: 'PUT', body: JSON.stringify({ roleId: 1, headcount: -5 }),
  });

  assert.equal(status, 400);
  assert.equal(body.error.details.headcount, 'out_of_range');
});
