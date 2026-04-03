-- Commit 13.7
-- Mirror explicit provider metadata onto operator-agent services_catalog.

ALTER TABLE services_catalog ADD COLUMN provider TEXT;

UPDATE services_catalog
SET provider = 'cloudflare'
WHERE id IN (
  'service_control_plane',
  'service_operator_agent',
  'service_dashboard',
  'service_ops_console'
)
  AND (provider IS NULL OR provider = '');