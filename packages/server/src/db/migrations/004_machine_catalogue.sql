-- Machine catalogue, operations, wage bands, and worker detail.
--
-- WHY THIS EXISTS
--
-- Until now `machinery_plans.headcount_displaced_per_unit` was typed in by the
-- user, which meant the product asked the factory for the answer it should be
-- computing. A factory knows what it is buying; it does not know how many
-- operators that machine displaces, and guessing is exactly the judgement the
-- tool is supposed to supply.
--
-- The catalogue moves that number into reference data with a source attached,
-- and adds the half of the picture that was missing entirely: machines also
-- CREATE demand — operators to run them, technicians to service them. Net
-- workforce effect is displaced minus created, and it is frequently not the
-- number a factory expects.

-- ---------------------------------------------------------------------------
-- Operations: the granular tasks a machine actually takes over
-- ---------------------------------------------------------------------------

CREATE TABLE operations (
  id             INTEGER PRIMARY KEY,
  code           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  -- How specifiable the task is, 0-100. This is what actually drives exposure:
  -- a straight seam automates readily, complex assembly does not.
  automatability INTEGER NOT NULL CHECK (automatability BETWEEN 0 AND 100),
  skill_level    TEXT    NOT NULL CHECK (skill_level IN ('entry', 'semi_skilled', 'skilled', 'specialist'))
);

CREATE INDEX idx_operations_role ON operations(role_id);

-- ---------------------------------------------------------------------------
-- Machine catalogue
-- ---------------------------------------------------------------------------

CREATE TABLE machine_types (
  id                    INTEGER PRIMARY KEY,
  slug                  TEXT    NOT NULL UNIQUE,
  name                  TEXT    NOT NULL,
  category              TEXT    NOT NULL CHECK (category IN
                          ('cutting', 'sewing', 'finishing', 'printing', 'handling', 'inspection', 'systems')),
  automation_level      TEXT    NOT NULL CHECK (automation_level IN
                          ('assisted', 'semi_automatic', 'fully_automatic')),

  capital_cost_bdt      INTEGER NOT NULL CHECK (capital_cost_bdt >= 0),
  install_lead_weeks    INTEGER NOT NULL CHECK (install_lead_weeks >= 0),

  -- People the machine needs. Fractional where one operator tends several units.
  operators_required    REAL    NOT NULL CHECK (operators_required >= 0),
  operator_skill_level  TEXT    NOT NULL CHECK (operator_skill_level IN
                          ('entry', 'semi_skilled', 'skilled', 'specialist')),
  maintenance_hours_per_month REAL NOT NULL CHECK (maintenance_hours_per_month >= 0),

  -- Output of one unit expressed in manual workers. The researched figure.
  throughput_workers_equivalent REAL NOT NULL CHECK (throughput_workers_equivalent >= 0),

  -- Set where the machine displaces work that is hazardous to do by hand.
  -- Adoption is then compliance-driven and moves faster than cost alone predicts.
  health_safety_note    TEXT,

  notes                 TEXT    NOT NULL DEFAULT '',
  source_ref            TEXT    NOT NULL CHECK (length(source_ref) > 0),
  confidence            TEXT    NOT NULL CHECK (confidence IN ('sourced', 'estimated'))
);

-- Which operations a machine takes over.
CREATE TABLE machine_operations (
  machine_type_id INTEGER NOT NULL REFERENCES machine_types(id) ON DELETE CASCADE,
  operation_id    INTEGER NOT NULL REFERENCES operations(id)    ON DELETE CASCADE,
  -- Share of that operation the machine absorbs, 0-100.
  coverage        INTEGER NOT NULL CHECK (coverage BETWEEN 0 AND 100),
  PRIMARY KEY (machine_type_id, operation_id)
);

-- The two-sided effect, per unit of machine, per role.
--
-- `workers_displaced_per_unit` replaces the figure the user used to type in.
-- `workers_created_per_unit` is the half the original model had no way to say:
-- an automated cutter destroys cutting jobs and creates supervision jobs, and a
-- plan that reports only the first is telling half the truth.
CREATE TABLE machine_role_impact (
  machine_type_id           INTEGER NOT NULL REFERENCES machine_types(id) ON DELETE CASCADE,
  role_id                   INTEGER NOT NULL REFERENCES roles(id)         ON DELETE CASCADE,
  workers_displaced_per_unit REAL   NOT NULL DEFAULT 0 CHECK (workers_displaced_per_unit >= 0),
  workers_created_per_unit   REAL   NOT NULL DEFAULT 0 CHECK (workers_created_per_unit >= 0),
  rationale                 TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY (machine_type_id, role_id)
);

-- ---------------------------------------------------------------------------
-- Wage bands: what makes payback and cost comparison computable
-- ---------------------------------------------------------------------------

CREATE TABLE wage_bands (
  role_id                  INTEGER PRIMARY KEY REFERENCES roles(id) ON DELETE CASCADE,
  -- Total monthly cost to the employer: wage, overtime, bonuses and benefits.
  monthly_cost_bdt         INTEGER NOT NULL CHECK (monthly_cost_bdt >= 0),
  source_ref               TEXT    NOT NULL,
  confidence               TEXT    NOT NULL CHECK (confidence IN ('sourced', 'estimated'))
);

-- ---------------------------------------------------------------------------
-- machinery_plans: point at the catalogue, make the override optional
-- ---------------------------------------------------------------------------

CREATE TABLE machinery_plans_new (
  id                           INTEGER PRIMARY KEY,
  factory_id                   INTEGER NOT NULL REFERENCES factories(id)     ON DELETE CASCADE,
  machine_type_id              INTEGER          REFERENCES machine_types(id) ON DELETE SET NULL,
  machine_name                 TEXT    NOT NULL CHECK (length(machine_name) > 0),
  affected_role_id             INTEGER NOT NULL REFERENCES roles(id)         ON DELETE CASCADE,
  arrival_date                 TEXT    NOT NULL CHECK (arrival_date LIKE '____-__-__'),
  units                        INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  -- NULL means "use the catalogue". A value overrides it, for a factory that
  -- knows its own line better than the reference data does.
  headcount_displaced_per_unit REAL             CHECK (headcount_displaced_per_unit >= 0)
);

INSERT INTO machinery_plans_new
  (id, factory_id, machine_type_id, machine_name, affected_role_id, arrival_date, units, headcount_displaced_per_unit)
SELECT id, factory_id, NULL, machine_name, affected_role_id, arrival_date, units, headcount_displaced_per_unit
FROM machinery_plans;

DROP TABLE machinery_plans;
ALTER TABLE machinery_plans_new RENAME TO machinery_plans;

CREATE INDEX idx_machinery_plans_factory ON machinery_plans(factory_id);

-- ---------------------------------------------------------------------------
-- workers: the fields that would actually make two people in a role differ
-- ---------------------------------------------------------------------------
--
-- Still unread by the engine in v1 and still pseudonymous — no name column, and
-- `external_ref` is the factory's own HR identifier. These columns exist so the
-- phase-4 model has somewhere to land, and so the shape of what we would ask
-- for is on the record and reviewable before anyone asks for it.

ALTER TABLE workers ADD COLUMN primary_operation_id INTEGER REFERENCES operations(id);
ALTER TABLE workers ADD COLUMN skill_grade TEXT NOT NULL DEFAULT 'semi_skilled';
ALTER TABLE workers ADD COLUMN operations_known INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workers ADD COLUMN literacy_level TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE workers ADD COLUMN digital_comfort TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE workers ADD COLUMN line_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE workers ADD COLUMN shift TEXT NOT NULL DEFAULT '';
