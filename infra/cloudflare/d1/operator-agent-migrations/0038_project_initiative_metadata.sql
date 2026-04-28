ALTER TABLE projects
  ADD COLUMN initiative_kind TEXT;

ALTER TABLE projects
  ADD COLUMN product_surface TEXT;

ALTER TABLE projects
  ADD COLUMN external_visibility TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_initiative_kind
  ON projects (initiative_kind);

CREATE INDEX IF NOT EXISTS idx_projects_product_surface
  ON projects (product_surface);