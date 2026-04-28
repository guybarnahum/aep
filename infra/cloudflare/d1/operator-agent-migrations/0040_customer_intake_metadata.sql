ALTER TABLE intake_requests
  ADD COLUMN external_surface_kind TEXT;

ALTER TABLE intake_requests
  ADD COLUMN product_surface TEXT;

ALTER TABLE intake_requests
  ADD COLUMN source_url TEXT;

ALTER TABLE intake_requests
  ADD COLUMN idempotency_key TEXT;

ALTER TABLE intake_requests
  ADD COLUMN customer_contact_json TEXT;

CREATE INDEX IF NOT EXISTS idx_intake_requests_external_surface_kind
  ON intake_requests (external_surface_kind);

CREATE INDEX IF NOT EXISTS idx_intake_requests_idempotency_key
  ON intake_requests (idempotency_key);
