-- ALE Insight — initial schema (v1)
--
-- Nine tables. The four in the original specification are here, plus five that
-- earn their place:
--
--   roles              canonical ids, so role matching never depends on spelling
--   factories          scoping that every other table already implied
--   role_headcounts    the low-friction input: 8 rows instead of 3,470
--   training_programs  makes "recommended training" a plan rather than a wish
--   analysis_runs      reproducibility, so a report sent months ago can be re-derived
--
-- Two constraints in this file are load-bearing and documented in docs/ethics.md:
--   1. findings.training_program_id is NOT NULL
--   2. findings.risk_score has no path to storage without a paired programme

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  id         INTEGER PRIMARY KEY,
  slug       TEXT    NOT NULL UNIQUE,
  label_bn   TEXT    NOT NULL,
  label_en   TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Alternate spellings. The concept documents used three different forms of the
-- same role name ("Cutting Machine Operator" / "Cutting Machine Operators" /
-- the Bangla label); every one of them resolves to a single role id here.
CREATE TABLE role_synonyms (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  -- Stored lowercase and whitespace-collapsed by the repository layer.
  synonym TEXT    NOT NULL,
  PRIMARY KEY (role_id, synonym)
);

CREATE UNIQUE INDEX idx_role_synonyms_synonym ON role_synonyms(synonym);

CREATE TABLE factories (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL,
  location TEXT    NOT NULL DEFAULT '',
  is_demo  INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1))
);

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------

-- Seeded, not user-editable in v1. Every row carries its reasoning and its
-- provenance: a factory manager will ask why 74, and "the CSV said so" is not
-- an answer that survives the meeting.
CREATE TABLE risk_rules (
  id              INTEGER PRIMARY KEY,
  role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  machine_trigger TEXT    NOT NULL,
  base_score      INTEGER NOT NULL CHECK (base_score BETWEEN 0 AND 100),
  band            TEXT    NOT NULL CHECK (band IN ('high', 'moderate', 'low')),
  rationale       TEXT    NOT NULL CHECK (length(rationale) > 0),
  source_ref      TEXT    NOT NULL CHECK (length(source_ref) > 0),
  confidence      TEXT    NOT NULL CHECK (confidence IN ('sourced', 'estimated')),
  UNIQUE (role_id, machine_trigger)
);

CREATE TABLE training_programs (
  id                INTEGER PRIMARY KEY,
  name              TEXT    NOT NULL,
  target_role_id    INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  duration_weeks    INTEGER NOT NULL CHECK (duration_weeks > 0),
  seats_per_month   INTEGER NOT NULL CHECK (seats_per_month > 0),
  cost_per_seat_bdt INTEGER NOT NULL CHECK (cost_per_seat_bdt >= 0),
  provider          TEXT    NOT NULL
);

CREATE INDEX idx_training_programs_role ON training_programs(target_role_id);

-- ---------------------------------------------------------------------------
-- Factory inputs
-- ---------------------------------------------------------------------------

CREATE TABLE role_headcounts (
  factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  role_id    INTEGER NOT NULL REFERENCES roles(id)     ON DELETE CASCADE,
  headcount  INTEGER NOT NULL CHECK (headcount >= 0),
  PRIMARY KEY (factory_id, role_id)
);

CREATE TABLE machinery_plans (
  id                            INTEGER PRIMARY KEY,
  factory_id                    INTEGER NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  machine_name                  TEXT    NOT NULL CHECK (length(machine_name) > 0),
  affected_role_id              INTEGER NOT NULL REFERENCES roles(id)     ON DELETE CASCADE,
  arrival_date                  TEXT    NOT NULL CHECK (arrival_date LIKE '____-__-__'),
  units                         INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  headcount_displaced_per_unit  INTEGER NOT NULL DEFAULT 12 CHECK (headcount_displaced_per_unit >= 0)
);

CREATE INDEX idx_machinery_plans_factory ON machinery_plans(factory_id);

-- Deferred to phase 4. The table exists so worker-level scoring has somewhere
-- to land, but v1 never reads it: the product runs on role headcounts, which
-- means it needs no worker names to be useful. Records are pseudonymous by
-- default — `external_ref` is the factory's own HR identifier, not a name.
CREATE TABLE workers (
  id                  INTEGER PRIMARY KEY,
  factory_id          INTEGER NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  role_id             INTEGER NOT NULL REFERENCES roles(id)     ON DELETE CASCADE,
  external_ref        TEXT    NOT NULL,
  tenure_months       INTEGER CHECK (tenure_months >= 0),
  cross_trained_roles TEXT    NOT NULL DEFAULT '[]',
  UNIQUE (factory_id, external_ref)
);

-- ---------------------------------------------------------------------------
-- Engine output
-- ---------------------------------------------------------------------------

-- One row per execution. `as_of_date` and the two version strings are what make
-- a run reproducible: we must be able to re-derive a report a factory sent to a
-- buyer eight months ago.
CREATE TABLE analysis_runs (
  id             INTEGER PRIMARY KEY,
  factory_id     INTEGER NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  run_at         TEXT    NOT NULL,
  as_of_date     TEXT    NOT NULL CHECK (as_of_date LIKE '____-__-__'),
  rules_version  TEXT    NOT NULL,
  engine_version TEXT    NOT NULL,
  finding_count  INTEGER NOT NULL DEFAULT 0 CHECK (finding_count >= 0)
);

CREATE INDEX idx_analysis_runs_factory ON analysis_runs(factory_id, id DESC);

-- The `risk_output` of the original specification, renamed for what it is.
--
-- training_program_id is NOT NULL by deliberate design. A risk score with no
-- recommended transition is a displaceability ranking, which is the one thing
-- this product must never produce. The engine skips any role it cannot answer
-- for and reports it as a coverage gap instead. See docs/ethics.md.
CREATE TABLE findings (
  id                   INTEGER PRIMARY KEY,
  run_id               INTEGER NOT NULL REFERENCES analysis_runs(id)     ON DELETE CASCADE,
  role_id              INTEGER NOT NULL REFERENCES roles(id)             ON DELETE CASCADE,
  machinery_plan_id    INTEGER NOT NULL REFERENCES machinery_plans(id)   ON DELETE CASCADE,
  training_program_id  INTEGER NOT NULL REFERENCES training_programs(id) ON DELETE RESTRICT,

  headcount            INTEGER NOT NULL CHECK (headcount >= 0),
  risk_score           INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_band            TEXT    NOT NULL CHECK (risk_band IN ('high', 'moderate', 'low')),
  rationale            TEXT    NOT NULL,
  source_ref           TEXT    NOT NULL,
  confidence           TEXT    NOT NULL CHECK (confidence IN ('sourced', 'estimated')),

  months_until_impact  INTEGER NOT NULL,
  workers_affected     INTEGER NOT NULL CHECK (workers_affected >= 0),
  cohorts_required     INTEGER NOT NULL CHECK (cohorts_required >= 0),
  start_by_date        TEXT    NOT NULL CHECK (start_by_date LIKE '____-__-__'),
  schedule_status      TEXT    NOT NULL CHECK (schedule_status IN ('on_track', 'starts_soon', 'overdue')),
  days_until_start_by  INTEGER NOT NULL,
  estimated_cost_bdt   INTEGER NOT NULL CHECK (estimated_cost_bdt >= 0)
);

CREATE INDEX idx_findings_run ON findings(run_id);
