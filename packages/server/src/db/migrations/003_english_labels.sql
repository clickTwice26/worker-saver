-- The product is English-only.
--
-- Drops the Bangla label column and renames the English one to plain `label`,
-- so nothing downstream carries a language suffix that no longer means anything.

ALTER TABLE roles DROP COLUMN label_bn;

ALTER TABLE roles RENAME COLUMN label_en TO label;
