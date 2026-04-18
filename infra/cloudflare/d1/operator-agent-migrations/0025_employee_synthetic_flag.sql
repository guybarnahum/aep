-- PR13G: mark synthetic (CI/test) employees for safe purge

ALTER TABLE employees_catalog
ADD COLUMN is_synthetic INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_employees_catalog_is_synthetic
ON employees_catalog(is_synthetic);