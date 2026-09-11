-- Real operation: imports, recorded outcomes, and a trained model.
--
-- WHY THIS EXISTS
--
-- The rule engine answers "what does the knowledge base say about this role".
-- It cannot answer "what actually happens in THIS factory", because nothing in
-- the system had ever recorded an actual result. These three tables close that
-- loop: data comes in from the factory's own files, outcomes are recorded once
-- an arrival has passed, and those outcomes are the only thing a model is ever
-- trained on. No labels, no model — the product says so rather than inventing
-- coefficients.

-- ---------------------------------------------------------------------------
-- Imports
-- ---------------------------------------------------------------------------

CREATE TABLE import_batches (
  id             INTEGER PRIMARY KEY,
  factory_id     INTEGER          REFERENCES factories(id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL CHECK (kind IN ('roster', 'machinery', 'workers', 'outcomes')),
  filename       TEXT    NOT NULL,
  rows_total     INTEGER NOT NULL CHECK (rows_total >= 0),
  rows_accepted  INTEGER NOT NULL CHECK (rows_accepted >= 0),
  rows_rejected  INTEGER NOT NULL CHECK (rows_rejected >= 0),
  -- Row-level errors, kept so a rejected import can be explained line by line
  -- rather than failing with a single unhelpful message.
  errors         TEXT    NOT NULL DEFAULT '[]',
  imported_at    TEXT    NOT NULL
);

CREATE INDEX idx_import_batches_factory ON import_batches(factory_id, id DESC);

-- ---------------------------------------------------------------------------
-- Outcomes: the labels
-- ---------------------------------------------------------------------------
--
-- One row per worker per arrival, recorded AFTER the fact. Features are stored
-- as they were at the time rather than read from the worker's current record:
-- training on today's values for a decision made two years ago leaks the future
-- into the past and produces a model that scores well and predicts nothing.

CREATE TABLE outcomes (
  id                     INTEGER PRIMARY KEY,
  factory_id             INTEGER NOT NULL REFERENCES factories(id)     ON DELETE CASCADE,
  -- Pseudonymous. The factory's own HR identifier, never a name.
  worker_ref             TEXT    NOT NULL,
  role_id                INTEGER NOT NULL REFERENCES roles(id)         ON DELETE CASCADE,
  machine_type_id        INTEGER          REFERENCES machine_types(id) ON DELETE SET NULL,
  arrival_date           TEXT    NOT NULL CHECK (arrival_date LIKE '____-__-__'),

  -- The label. `displaced` is the positive class.
  outcome                TEXT    NOT NULL CHECK (outcome IN ('retained', 'redeployed', 'displaced')),

  -- Features as at the arrival date.
  tenure_months          INTEGER CHECK (tenure_months >= 0),
  operations_known       INTEGER CHECK (operations_known >= 0),
  skill_grade            TEXT    NOT NULL DEFAULT 'semi_skilled'
                           CHECK (skill_grade IN ('entry', 'semi_skilled', 'skilled', 'specialist')),
  primary_operation_id   INTEGER          REFERENCES operations(id)    ON DELETE SET NULL,
  trained_before_arrival INTEGER NOT NULL DEFAULT 0 CHECK (trained_before_arrival IN (0, 1)),

  recorded_at            TEXT    NOT NULL,
  import_batch_id        INTEGER          REFERENCES import_batches(id) ON DELETE SET NULL,

  UNIQUE (factory_id, worker_ref, arrival_date)
);

CREATE INDEX idx_outcomes_factory ON outcomes(factory_id);
CREATE INDEX idx_outcomes_role ON outcomes(role_id);

-- ---------------------------------------------------------------------------
-- Trained models
-- ---------------------------------------------------------------------------
--
-- Every fit is stored with the metrics that justify it and with the rule
-- engine's score on the same held-out folds. `beats_baseline` is what gates
-- the model into production: a model that cannot outperform the lookup table it
-- replaces is not an improvement, and the engine keeps using the rules.

CREATE TABLE ml_models (
  id              INTEGER PRIMARY KEY,
  factory_id      INTEGER          REFERENCES factories(id) ON DELETE CASCADE,
  algorithm       TEXT    NOT NULL,
  feature_names   TEXT    NOT NULL,
  weights         TEXT    NOT NULL,
  intercept       REAL    NOT NULL,
  -- Standardisation constants, so prediction applies the same transform as fit.
  feature_means   TEXT    NOT NULL,
  feature_stds    TEXT    NOT NULL,

  n_samples       INTEGER NOT NULL CHECK (n_samples >= 0),
  n_positive      INTEGER NOT NULL CHECK (n_positive >= 0),
  folds           INTEGER NOT NULL DEFAULT 5,

  -- Cross-validated, not training-set, figures.
  auc             REAL,
  brier           REAL,
  accuracy        REAL,
  baseline_auc    REAL,
  beats_baseline  INTEGER NOT NULL DEFAULT 0 CHECK (beats_baseline IN (0, 1)),

  is_active       INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  trained_at      TEXT    NOT NULL,
  notes           TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX idx_ml_models_factory ON ml_models(factory_id, id DESC);

-- Which engine produced each finding's score, so a number can always be traced
-- to the thing that made it.
ALTER TABLE findings ADD COLUMN score_source TEXT NOT NULL DEFAULT 'rules'
  CHECK (score_source IN ('rules', 'model'));
ALTER TABLE findings ADD COLUMN model_id INTEGER REFERENCES ml_models(id);
