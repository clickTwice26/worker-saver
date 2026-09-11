-- Persist the analytical fields alongside each finding.
--
-- They are stored rather than recomputed on read so a report sent to a buyer
-- months ago still shows the figures it was sent with, even after the machine
-- catalogue or the wage bands have been revised.

ALTER TABLE findings ADD COLUMN workers_created INTEGER NOT NULL DEFAULT 0;
ALTER TABLE findings ADD COLUMN net_workforce_change INTEGER NOT NULL DEFAULT 0;
ALTER TABLE findings ADD COLUMN derived_from_catalogue INTEGER NOT NULL DEFAULT 0
  CHECK (derived_from_catalogue IN (0, 1));
ALTER TABLE findings ADD COLUMN machine_type_name TEXT;
ALTER TABLE findings ADD COLUMN health_safety_note TEXT;
ALTER TABLE findings ADD COLUMN monthly_labour_saving_bdt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE findings ADD COLUMN capital_cost_bdt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE findings ADD COLUMN payback_months INTEGER;
ALTER TABLE findings ADD COLUMN retraining_cost_ratio REAL;
