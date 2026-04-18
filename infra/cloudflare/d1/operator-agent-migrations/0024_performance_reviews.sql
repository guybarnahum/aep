CREATE TABLE IF NOT EXISTS role_review_dimensions (
  role_id TEXT NOT NULL,
  dimension_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  weight REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, dimension_key)
);

CREATE TABLE IF NOT EXISTS employee_review_cycles (
  review_cycle_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_performance_reviews (
  review_id TEXT PRIMARY KEY,
  review_cycle_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  strengths_json TEXT NOT NULL,
  gaps_json TEXT NOT NULL,
  dimension_scores_json TEXT NOT NULL,
  recommendations_json TEXT NOT NULL,
  created_by TEXT,
  approved_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_cycle_id) REFERENCES employee_review_cycles(review_cycle_id),
  FOREIGN KEY (employee_id) REFERENCES employees_catalog(id)
);

CREATE TABLE IF NOT EXISTS employee_review_evidence_links (
  review_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_performance_reviews_employee_id
  ON employee_performance_reviews(employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_performance_reviews_review_cycle_id
  ON employee_performance_reviews(review_cycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_review_evidence_links_review_id
  ON employee_review_evidence_links(review_id, created_at DESC);

INSERT OR IGNORE INTO role_review_dimensions (
  role_id,
  dimension_key,
  label,
  description,
  weight
) VALUES
  ('product-manager-web', 'planning_quality', 'Planning Quality', 'Quality of planning, decomposition, and sequencing.', 0.30),
  ('product-manager-web', 'coordination', 'Coordination', 'Clarity and effectiveness of cross-team coordination.', 0.25),
  ('product-manager-web', 'delivery_judgment', 'Delivery Judgment', 'Quality of prioritization and execution judgment.', 0.25),
  ('product-manager-web', 'governance', 'Governance', 'Adherence to canonical task and thread governance.', 0.20),
  ('frontend-engineer', 'implementation_quality', 'Implementation Quality', 'Quality and completeness of implementation work.', 0.35),
  ('frontend-engineer', 'delivery_reliability', 'Delivery Reliability', 'Timeliness and reliability of delivered work.', 0.25),
  ('frontend-engineer', 'collaboration', 'Collaboration', 'Responsiveness and collaboration through canonical threads.', 0.20),
  ('frontend-engineer', 'governance', 'Governance', 'Adherence to canonical task, artifact, and thread boundaries.', 0.20),
  ('validation-engineer', 'validation_quality', 'Validation Quality', 'Quality and accuracy of validation outputs.', 0.35),
  ('validation-engineer', 'evidence_quality', 'Evidence Quality', 'Durability and usefulness of produced evidence.', 0.25),
  ('validation-engineer', 'reliability', 'Reliability', 'Consistency and completeness of executed validation work.', 0.20),
  ('validation-engineer', 'governance', 'Governance', 'Appropriate use of canonical surfaces and escalation behavior.', 0.20);