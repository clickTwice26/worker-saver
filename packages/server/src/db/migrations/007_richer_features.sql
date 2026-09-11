-- Richer worker features, and a second prediction target.
--
-- Two changes, both aimed at the same problem: within a role, the model had
-- almost nothing to tell two workers apart.
--
-- 1. Finer worker detail — the share of time on the primary operation, how long
--    the worker took to reach standard output last time they learned something,
--    literacy and digital comfort. `time_to_competency_weeks` deliberately
--    replaces any notion of a "learning ability" rating: an observed ramp-up is
--    measurable, where a supervisor's opinion of someone's aptitude carries
--    whatever bias produced it and would be learned as signal.
--
-- 2. A second label. `displaced` is only knowable after a machine lands, so
--    those labels accrue over years. Retraining success is knowable weeks after
--    a cohort runs, which means a factory can have a useful model in months.

ALTER TABLE workers ADD COLUMN primary_operation_share REAL CHECK (primary_operation_share BETWEEN 0 AND 1);
ALTER TABLE workers ADD COLUMN time_to_competency_weeks REAL CHECK (time_to_competency_weeks >= 0);
ALTER TABLE workers ADD COLUMN prior_trainings INTEGER NOT NULL DEFAULT 0 CHECK (prior_trainings >= 0);
ALTER TABLE workers ADD COLUMN prior_trainings_passed INTEGER NOT NULL DEFAULT 0 CHECK (prior_trainings_passed >= 0);

ALTER TABLE outcomes ADD COLUMN primary_operation_share REAL CHECK (primary_operation_share BETWEEN 0 AND 1);
ALTER TABLE outcomes ADD COLUMN time_to_competency_weeks REAL CHECK (time_to_competency_weeks >= 0);
ALTER TABLE outcomes ADD COLUMN prior_trainings INTEGER NOT NULL DEFAULT 0 CHECK (prior_trainings >= 0);
ALTER TABLE outcomes ADD COLUMN prior_trainings_passed INTEGER NOT NULL DEFAULT 0 CHECK (prior_trainings_passed >= 0);
ALTER TABLE outcomes ADD COLUMN literacy_level TEXT NOT NULL DEFAULT 'unknown'
  CHECK (literacy_level IN ('unknown', 'none', 'basic', 'functional', 'fluent'));
ALTER TABLE outcomes ADD COLUMN digital_comfort TEXT NOT NULL DEFAULT 'unknown'
  CHECK (digital_comfort IN ('unknown', 'none', 'basic', 'confident'));
ALTER TABLE outcomes ADD COLUMN line_ref TEXT NOT NULL DEFAULT '';

-- The second target. NULL where the worker was never enrolled, which is most
-- rows; those are excluded from the retraining model rather than counted as
-- failures.
ALTER TABLE outcomes ADD COLUMN retraining_result TEXT
  CHECK (retraining_result IS NULL OR retraining_result IN ('passed', 'failed', 'not_enrolled'));

-- Which target a model was fitted for.
ALTER TABLE ml_models ADD COLUMN target TEXT NOT NULL DEFAULT 'displacement'
  CHECK (target IN ('displacement', 'retraining_success'));
-- Selection and diagnostics, so a stored model can be audited after the fact.
ALTER TABLE ml_models ADD COLUMN hyperparameters TEXT NOT NULL DEFAULT '{}';
ALTER TABLE ml_models ADD COLUMN auc_ci_low REAL;
ALTER TABLE ml_models ADD COLUMN auc_ci_high REAL;
ALTER TABLE ml_models ADD COLUMN calibration TEXT NOT NULL DEFAULT '[]';
ALTER TABLE ml_models ADD COLUMN permutation_importance TEXT NOT NULL DEFAULT '[]';
ALTER TABLE ml_models ADD COLUMN learning_curve TEXT NOT NULL DEFAULT '[]';
ALTER TABLE ml_models ADD COLUMN candidates TEXT NOT NULL DEFAULT '[]';
ALTER TABLE ml_models ADD COLUMN precision_score REAL;
ALTER TABLE ml_models ADD COLUMN recall_score REAL;
ALTER TABLE ml_models ADD COLUMN f1_score REAL;

DROP INDEX IF EXISTS idx_ml_models_factory;
CREATE INDEX idx_ml_models_factory ON ml_models(factory_id, target, id DESC);
