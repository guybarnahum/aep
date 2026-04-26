-- Migration: 0035_ci_creator_tracking.sql
-- Goal: Enable unified CI artifact tracking by adding created_by_employee_id to employees_catalog

PRAGMA foreign_keys = ON;

-- Add created_by_employee_id column to track who/what created each employee record
-- Used with ciActor() pattern to identify and clean up CI test artifacts
ALTER TABLE employees_catalog ADD COLUMN created_by_employee_id TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_catalog_created_by
  ON employees_catalog(created_by_employee_id);

-- Support querying synthetic CI employees
CREATE INDEX IF NOT EXISTS idx_employees_catalog_is_synthetic
  ON employees_catalog(is_synthetic);

-- Combined index for purge operations: find all CI-created synthetic employees
CREATE INDEX IF NOT EXISTS idx_employees_catalog_ci_artifact
  ON employees_catalog(is_synthetic, created_by_employee_id);
