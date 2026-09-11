-- Adds descriptive detail used by the knowledge-base and factory-switcher views.
--
-- `roles.department` groups the taxonomy by where a role sits on the floor.
-- `factories.product_mix` distinguishes the demo factories from one another,
-- since the same engine reaches different conclusions from different rosters.

ALTER TABLE roles ADD COLUMN department TEXT NOT NULL DEFAULT 'support';

ALTER TABLE factories ADD COLUMN product_mix TEXT NOT NULL DEFAULT '';
