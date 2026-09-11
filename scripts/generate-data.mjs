#!/usr/bin/env node
/**
 * Synthetic data generator.
 *
 * Reads the seeded knowledge base — real roles, real operations with their real
 * automatability scores, real machine displacement rates — and generates CSVs
 * consistent with it. A worker on `sew-straight-seam` is exposed because that
 * operation genuinely scores 86, not because a random number said so, which
 * means a model trained on the output learns the same relationships it would
 * learn from a real factory.
 *
 * THIS IS TEST DATA. Files land in a directory you name; the product itself
 * still ships with no factories.
 *
 *   npm run generate:data -- --workers 1000000 --out ./generated
 *
 * SCALE
 *
 * Rows are streamed to disk, and worker attributes are derived from a per-index
 * seed rather than held in an array. A million worker objects would be roughly
 * half a gigabyte of heap; `workerAt(i)` reproduces any worker on demand from
 * its index, so memory stays flat regardless of row count and the workers and
 * outcomes files can be written independently.
 *
 * Noise is deliberate. A generator that produces a perfectly separable problem
 * yields AUC 1.0, which tells you the plumbing works and nothing about whether
 * the model is any good.
 */

import { DatabaseSync } from 'node:sqlite';
import { createWriteStream, mkdirSync } from 'node:fs';
import { once } from 'node:events';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const WORKERS = Number(arg('workers', 5000));
const OUTCOMES = Number(arg('outcomes', 0)); // 0 = derive from arrivals
const ARRIVALS = Number(arg('arrivals', 18));
const OUT = resolve(arg('out', join(here, '..', 'generated')));
const DB_PATH = arg('db', join(here, '..', 'packages', 'server', 'data', 'ale.db'));
const SEED = Number(arg('seed', 20260911));

/** Deterministic PRNG, seeded per call site so any row is reproducible. */
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Mixes an index into a seed so worker N is always the same worker. */
const hash = (a, b) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 15;
  return h >>> 0;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const gauss = (r, mean, sd) => {
  const u = Math.max(r(), 1e-9);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};
const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Buffered writer: one `write` per row would spend the run in syscalls. */
function makeWriter(path, headers) {
  const stream = createWriteStream(path);
  let buffer = `${headers.join(',')}\n`;
  let rows = 0;

  return {
    async write(values) {
      buffer += `${values.map(csvEscape).join(',')}\n`;
      rows += 1;
      if (buffer.length > 1 << 20) {
        const chunk = buffer;
        buffer = '';
        if (!stream.write(chunk)) await once(stream, 'drain');
      }
    },
    async close() {
      if (buffer) stream.write(buffer);
      stream.end();
      await once(stream, 'finish');
      return rows;
    },
  };
}

// --- read the knowledge base ------------------------------------------------

const db = new DatabaseSync(DB_PATH, { readOnly: true });

const roles = db.prepare('SELECT id, slug, label FROM roles ORDER BY sort_order').all();
const operations = db.prepare('SELECT id, code, role_id, automatability FROM operations').all();
const machines = db.prepare('SELECT id, slug, name FROM machine_types').all();
const impacts = db.prepare(`
  SELECT machine_type_id, role_id, workers_displaced_per_unit
  FROM machine_role_impact WHERE workers_displaced_per_unit > 0
`).all();

if (roles.length === 0) {
  console.error('No reference data found. Run `npm run db:reset` first.');
  process.exit(1);
}

const opsByRole = new Map();
for (const op of operations) {
  const bucket = opsByRole.get(op.role_id) ?? [];
  bucket.push(op);
  opsByRole.set(op.role_id, bucket);
}

/** A real floor is dominated by sewing and helpers. */
const ROLE_SHARE = {
  'sewing-machine-operator': 0.34, 'helper-operator': 0.18, 'finishing-ironing-staff': 0.10,
  'packing-staff': 0.08, 'quality-inspector': 0.06, 'cutting-machine-operator': 0.05,
  'line-supervisor': 0.04, 'maintenance-technician': 0.025, 'fabric-spreader': 0.022,
  'store-inventory-clerk': 0.018, 'embroidery-machine-operator': 0.017,
  'screen-printing-operator': 0.015, 'fabric-pattern-cutter': 0.014,
  'washing-plant-operator': 0.013, 'merchandiser': 0.008, 'industrial-engineer': 0.004,
};

const rosterRoles = roles.filter((r) => ROLE_SHARE[r.slug]);
const headcounts = rosterRoles.map((r) => ({
  role: r,
  headcount: Math.max(4, Math.round(WORKERS * ROLE_SHARE[r.slug])),
}));

// Index ranges, so a worker index maps straight to its role without a lookup
// table of a million entries.
const ranges = [];
let cursor = 0;
for (const { role, headcount } of headcounts) {
  ranges.push({ role, start: cursor, end: cursor + headcount });
  cursor += headcount;
}
const TOTAL_WORKERS = cursor;

const GRADES = ['entry', 'semi_skilled', 'skilled', 'specialist'];
const LITERACY = ['none', 'basic', 'functional', 'fluent'];
const DIGITAL = ['none', 'basic', 'confident'];

function roleForIndex(i) {
  // Ranges are ordered, so a binary search beats scanning on large rosters.
  let lo = 0; let hi = ranges.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (i >= ranges[mid].end) lo = mid + 1;
    else hi = mid;
  }
  return ranges[lo].role;
}

/**
 * Reproduce worker `i` from its index alone.
 *
 * The whole reason the generator scales: nothing is retained between rows.
 */
function workerAt(i) {
  const r = makeRng(hash(SEED, i));
  const role = roleForIndex(i);
  const roleOps = opsByRole.get(role.id) ?? [];

  const tenure = Math.round(clamp(Math.abs(gauss(r, 0, 44)) + 2, 1, 300));
  const operationsKnown = clamp(Math.round(1 + tenure / 36 + gauss(r, 0, 1.1)), 1, 8);
  const gradeIndex = clamp(Math.round((operationsKnown - 1) / 2 + gauss(r, 0, 0.6)), 0, 3);

  // Less-tenured workers cluster on the simpler, more automatable operations.
  let operation = null;
  if (roleOps.length > 0) {
    const weights = roleOps.map((op) => (tenure < 24 ? op.automatability + 5 : 105 - op.automatability));
    let pickPoint = r() * weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < roleOps.length; k += 1) {
      pickPoint -= weights[k];
      if (pickPoint <= 0) { operation = roleOps[k]; break; }
    }
    operation ??= roleOps[roleOps.length - 1];
  }

  const priorTrainings = Math.max(0, Math.round(tenure / 40 + gauss(r, 0, 0.7)));

  return {
    ref: `HR-${String(i + 1).padStart(7, '0')}`,
    role,
    tenure,
    operationsKnown,
    gradeIndex,
    grade: GRADES[gradeIndex],
    operation,
    automatability: operation ? operation.automatability : 50,
    share: Number(clamp(gauss(r, 0.68, 0.16), 0.2, 1).toFixed(2)),
    competencyWeeks: Number(clamp(gauss(r, 8 - gradeIndex * 1.4, 2.4), 1, 30).toFixed(1)),
    priorTrainings,
    priorPassed: priorTrainings === 0 ? 0
      : clamp(Math.round(priorTrainings * clamp(gauss(r, 0.74, 0.2), 0, 1)), 0, priorTrainings),
    literacy: LITERACY[clamp(Math.round(gradeIndex * 0.7 + gauss(r, 1, 0.9)), 0, 3)],
    digital: DIGITAL[clamp(Math.round(gradeIndex * 0.6 + gauss(r, 0.3, 0.7)), 0, 2)],
    line: `L${1 + Math.floor(r() * 14)}`,
    shift: r() < 0.72 ? 'A' : 'B',
  };
}

// --- arrivals ---------------------------------------------------------------

const today = new Date();
const shiftMonths = (months) => {
  const d = new Date(today);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

const rosterRoleIds = new Set(rosterRoles.map((r) => r.id));
const usableImpacts = impacts.filter((i) => rosterRoleIds.has(i.role_id));
const planRng = makeRng(hash(SEED, 0xa11));

const pastArrivals = Array.from({ length: ARRIVALS }, () => {
  const impact = usableImpacts[Math.floor(planRng() * usableImpacts.length)];
  return {
    impact,
    machine: machines.find((m) => m.id === impact.machine_type_id),
    role: roles.find((r) => r.id === impact.role_id),
    date: shiftMonths(-(6 + Math.floor(planRng() * 30))),
  };
});

const futureArrivals = Array.from({ length: Math.max(3, Math.round(ARRIVALS / 2)) }, () => {
  const impact = usableImpacts[Math.floor(planRng() * usableImpacts.length)];
  return {
    machine: machines.find((m) => m.id === impact.machine_type_id),
    date: shiftMonths(1 + Math.floor(planRng() * 22)),
    units: 1 + Math.floor(planRng() * 8),
  };
});

// Which worker indices belong to each role, as ranges rather than lists.
const rangeByRoleId = new Map(ranges.map((r) => [r.role.id, r]));

// --- write ------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
const started = Date.now();

// roster.csv — one row per role. It is small by nature; a million rows here
// would mean a million distinct job titles.
const roster = makeWriter(join(OUT, 'roster.csv'), ['role', 'workers']);
for (const { role, headcount } of headcounts) await roster.write([role.label, headcount]);
const rosterRows = await roster.close();

const machinery = makeWriter(join(OUT, 'machinery.csv'),
  ['machine_type', 'machine_name', 'arrival_date', 'units']);
for (const a of futureArrivals) {
  await machinery.write([a.machine.slug, a.machine.name, a.date, a.units]);
}
const machineryRows = await machinery.close();

const workersOut = makeWriter(join(OUT, 'workers.csv'), [
  'worker_ref', 'role', 'tenure_months', 'operations_known', 'skill_grade', 'operation',
  'primary_operation_share', 'time_to_competency_weeks', 'prior_trainings',
  'prior_trainings_passed', 'literacy_level', 'digital_comfort', 'line', 'shift',
]);
for (let i = 0; i < TOTAL_WORKERS; i += 1) {
  const w = workerAt(i);
  await workersOut.write([
    w.ref, w.role.label, w.tenure, w.operationsKnown, w.grade, w.operation ? w.operation.code : '',
    w.share, w.competencyWeeks, w.priorTrainings, w.priorPassed, w.literacy, w.digital,
    w.line, w.shift,
  ]);
  if (i > 0 && i % 250000 === 0) process.stdout.write(`  workers ${i.toLocaleString()}\r`);
}
const workerRows = await workersOut.close();

// outcomes.csv — the training labels.
const targetOutcomes = OUTCOMES > 0 ? OUTCOMES : Math.min(TOTAL_WORKERS * 2, 200000);
const outcomesOut = makeWriter(join(OUT, 'outcomes.csv'), [
  'worker_ref', 'role', 'arrival_date', 'outcome', 'machine_type', 'tenure_months',
  'operations_known', 'skill_grade', 'operation', 'primary_operation_share',
  'time_to_competency_weeks', 'prior_trainings', 'prior_trainings_passed',
  'literacy_level', 'digital_comfort', 'line_ref', 'trained_before_arrival',
  'retraining_result',
]);

let written = 0;
let displacedCount = 0;
let enrolledCount = 0;
let passedCount = 0;

// Allocate by capacity, not equally.
//
// (factory, worker_ref, arrival_date) is unique, so one arrival can contribute
// at most as many rows as its role has workers — which is exactly why a worker
// appears once per arrival they lived through, and why folds have to be group
// aware. Splitting the target evenly leaves arrivals on small roles short and
// the total under target, so the shortfall is redistributed to the arrivals
// that still have room.
const capacity = pastArrivals.map((a) => {
  const range = rangeByRoleId.get(a.role.id);
  return range ? range.end - range.start : 0;
});
const totalCapacity = capacity.reduce((a, b) => a + b, 0);

if (totalCapacity === 0) {
  console.error('No arrival lands on a role with workers; nothing to label.');
  process.exit(1);
}
if (totalCapacity < targetOutcomes) {
  console.warn(`  note: ${pastArrivals.length} arrivals over this roster can carry at most ` +
    `${totalCapacity.toLocaleString()} outcome rows. Raise --arrivals or --workers for more.`);
}

const allocation = capacity.map((c) =>
  Math.min(c, Math.ceil((c / totalCapacity) * targetOutcomes)));

for (let a = 0; a < pastArrivals.length; a += 1) {
  const arrival = pastArrivals[a];
  const range = rangeByRoleId.get(arrival.role.id);
  if (!range) continue;
  const take = allocation[a];

  for (let n = 0; n < take && written < targetOutcomes; n += 1) {
    const w = workerAt(range.start + n);
    const r = makeRng(hash(hash(SEED, range.start + n), arrival.date.length * 7919 + n));

    const trainedBefore = r() < 0.34;
    const exposure = (w.automatability / 100) * w.share;

    // The true generating process.
    let logit = -2.1
      + 3.6 * exposure
      - 0.55 * (w.operationsKnown - 1)
      - 0.010 * Math.min(w.tenure, 180)
      - 0.45 * w.gradeIndex
      - 1.5 * (trainedBefore ? 1 : 0)
      + 0.35 * (arrival.impact.workers_displaced_per_unit / 10);
    logit += gauss(r, 0, 1.25); // irreducible noise

    const displaced = 1 / (1 + Math.exp(-logit)) > r();
    const outcome = displaced ? 'displaced' : (r() < 0.22 ? 'redeployed' : 'retained');

    // Retraining success is generated by a different process, so the two
    // models genuinely learn different things.
    let retraining = 'not_enrolled';
    if (trainedBefore || r() < 0.45) {
      const passLogit = 1.1
        - 0.14 * w.competencyWeeks
        + 0.5 * (w.operationsKnown - 1)
        + 0.4 * LITERACY.indexOf(w.literacy)
        + 0.3 * DIGITAL.indexOf(w.digital)
        + gauss(r, 0, 1.1);
      retraining = 1 / (1 + Math.exp(-passLogit)) > r() ? 'passed' : 'failed';
      enrolledCount += 1;
      if (retraining === 'passed') passedCount += 1;
    }
    if (displaced) displacedCount += 1;

    await outcomesOut.write([
      w.ref, w.role.label, arrival.date, outcome, arrival.machine.slug, w.tenure,
      w.operationsKnown, w.grade, w.operation ? w.operation.code : '', w.share,
      w.competencyWeeks, w.priorTrainings, w.priorPassed, w.literacy, w.digital,
      w.line, trainedBefore ? 'yes' : 'no', retraining,
    ]);
    written += 1;
    if (written % 250000 === 0) process.stdout.write(`  outcomes ${written.toLocaleString()}\r`);
  }
}
const outcomeRows = await outcomesOut.close();

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`Generated into ${OUT}  (${seconds}s)`);
console.log(`  roster.csv     ${rosterRows.toLocaleString()} roles`);
console.log(`  machinery.csv  ${machineryRows.toLocaleString()} future arrivals`);
console.log(`  workers.csv    ${workerRows.toLocaleString()} rows`);
console.log(`  outcomes.csv   ${outcomeRows.toLocaleString()} rows across ${pastArrivals.length} past arrivals`);
console.log(`                 ${displacedCount.toLocaleString()} displaced ` +
  `(${(displacedCount / Math.max(outcomeRows, 1) * 100).toFixed(1)}%), ` +
  `${enrolledCount.toLocaleString()} enrolled, ${passedCount.toLocaleString()} passed`);
console.log(`  seed ${SEED} — rerun with --seed to reproduce exactly`);

db.close();
