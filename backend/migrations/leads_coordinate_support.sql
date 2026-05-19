-- leads_coordinate_support.sql
-- SKUAS Pest Control CRM
-- Safe lead migration for older databases
-- No UI or API changes required.
--
-- Notes:
-- 1. The lead form already stores searchAddress in payload JSON.
-- 2. These columns already exist in the current schema, so this file is
--    only needed if an older live database is missing them.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS google_place_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8) NULL,
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8) NULL;

