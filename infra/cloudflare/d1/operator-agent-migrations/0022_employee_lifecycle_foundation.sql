-- PR13A: employee lifecycle foundation + public role model.
-- This migration introduces:
-- - employment status separate from runtime status
-- - canonical public role / job description records
-- - public employee links / footprint
-- - public/private visual identity split
-- - employment event history

ALTER TABLE employees_catalog
ADD COLUMN employment_status TEXT NOT NULL DEFAULT 'active';

UPDATE employees_catalog
SET employment_status = 'active'
WHERE employment_status IS NULL OR employment_status = '';

CREATE TABLE IF NOT EXISTS roles_catalog (
  role_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  team_id TEXT NOT NULL,
  job_description_text TEXT NOT NULL,
  responsibilities_json TEXT NOT NULL,
  success_metrics_json TEXT NOT NULL,
  constraints_json TEXT NOT NULL,
  seniority_level TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_roles_catalog_team_id
  ON roles_catalog(team_id);

CREATE TABLE IF NOT EXISTS employee_public_links (
  link_id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  url TEXT NOT NULL,
  is_verified INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees_catalog(id)
);

CREATE INDEX IF NOT EXISTS idx_employee_public_links_employee_id
  ON employee_public_links(employee_id);

CREATE TABLE IF NOT EXISTS employee_visual_identity (
  employee_id TEXT PRIMARY KEY,
  public_appearance_summary TEXT,
  birth_year INTEGER,
  avatar_asset_url TEXT,
  visual_base_prompt TEXT,
  portrait_prompt TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees_catalog(id)
);

CREATE TABLE IF NOT EXISTS employee_employment_events (
  event_id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_team_id TEXT,
  to_team_id TEXT,
  from_role_id TEXT,
  to_role_id TEXT,
  effective_at TEXT NOT NULL,
  reason TEXT,
  approved_by TEXT,
  thread_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees_catalog(id),
  FOREIGN KEY (from_team_id) REFERENCES teams(id),
  FOREIGN KEY (to_team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_employee_employment_events_employee_id
  ON employee_employment_events(employee_id);

INSERT OR IGNORE INTO roles_catalog (
  role_id,
  title,
  team_id,
  job_description_text,
  responsibilities_json,
  success_metrics_json,
  constraints_json,
  seniority_level
) VALUES
  (
    'timeout-recovery-operator',
    'Timeout Recovery Operator',
    'team_infra',
    'Monitors timeout-prone work and applies bounded recovery actions within approved authority and budget.',
    '["Monitor timeout-prone jobs","Apply bounded timeout recovery","Verify recovery results"]',
    '["Recovery actions succeed without uncontrolled mutation","Verification evidence is recorded"]',
    '["Must stay within authority and budget","Must preserve trace verification requirements"]',
    'operator'
  ),
  (
    'infra-ops-manager',
    'Infra Operations Manager',
    'team_infra',
    'Supervises infra employees, emits manager decisions, and governs escalation and approval behavior.',
    '["Observe employee work patterns","Issue governance decisions","Escalate when intervention is required"]',
    '["Governance actions are explicit","Escalations and approvals are canonically recorded"]',
    '["Must not bypass canonical governance","Must preserve employee cognition boundaries"]',
    'manager'
  ),
  (
    'retry-supervisor',
    'Retry Supervisor',
    'team_infra',
    'Supervises retry behavior and bounded recovery work for infra reliability issues.',
    '["Identify retry candidates","Execute bounded retry supervision","Record work outcomes"]',
    '["Retries are bounded","Operator action outcomes are visible and auditable"]',
    '["Must remain within operator authority","Must avoid uncontrolled mutation"]',
    'operator'
  ),
  (
    'teardown-safety-operator',
    'Teardown Safety Operator',
    'team_infra',
    'Protects teardown operations through bounded safety checks and governed action gating.',
    '["Inspect teardown conditions","Recommend or execute safe bounded actions","Escalate unsafe conditions"]',
    '["Unsafe teardown is prevented","Safety decisions are visible and auditable"]',
    '["Must preserve production safeguards","Must route high-risk actions through governance"]',
    'operator'
  ),
  (
    'incident-triage-operator',
    'Incident Triage Operator',
    'team_infra',
    'Assesses incidents, structures early response, and escalates issues through canonical governance surfaces.',
    '["Triage incidents","Structure early response","Escalate critical failures"]',
    '["Incidents are categorized clearly","Escalations are timely and explicit"]',
    '["Must not bypass governance","Must preserve evidence and auditability"]',
    'operator'
  ),
  (
    'product-manager',
    'Product Manager',
    'team_infra',
    'Translates strategic goals into structured execution plans, task graphs, and cross-team coordination.',
    '["Define work structure","Decompose goals into tasks","Coordinate across teams"]',
    '["Plans are actionable","Task graphs are coherent","Cross-team routing is explicit"]',
    '["Must not leak private cognition","Must operate through canonical task and thread surfaces"]',
    'manager'
  ),
  (
    'product-manager-web',
    'Product Manager Web',
    'team_web_product',
    'Owns web product planning, sequencing, and structured delivery coordination.',
    '["Plan web delivery","Sequence work across design, implementation, and validation","Publish bounded rationale"]',
    '["Plans map clearly to execution","Dependencies are explicit","Rationale is legible"]',
    '["Must preserve canonicality","Must avoid hidden control semantics"]',
    'manager'
  ),
  (
    'frontend-engineer',
    'Frontend Engineer',
    'team_web_product',
    'Implements web product tasks and delivers bounded frontend work products inside canonical task execution.',
    '["Implement frontend work","Respond to assigned tasks","Publish visible outputs"]',
    '["Assigned work completes successfully","Artifacts and outputs are reviewable"]',
    '["Must stay within assigned scope","Must preserve canonical task ownership"]',
    'engineer'
  ),
  (
    'validation-pm',
    'Validation PM',
    'team_validation',
    'Plans validation work, structures review priorities, and coordinates validation throughput.',
    '["Plan validation work","Sequence validation priorities","Coordinate validation execution"]',
    '["Validation work is structured","Priorities are clear and auditable"]',
    '["Must preserve canonical governance","Must not expose hidden cognition"]',
    'manager'
  ),
  (
    'validation-engineer',
    'Validation Engineer',
    'team_validation',
    'Executes validation tasks and produces bounded validation outputs and reviewable evidence.',
    '["Execute validation tasks","Produce evidence","Report failures and recommendations"]',
    '["Validation results are clear","Evidence is durable and reviewable"]',
    '["Must avoid uncontrolled mutation","Must preserve bounded rationale publication"]',
    'engineer'
  ),
  (
    'reliability-engineer',
    'Site Reliability Engineer (Agent)',
    'team_validation',
    'Validates deployment targets, records validation results, and publishes bounded rationale on canonical work.',
    '["Run deployment validation","Publish validation artifacts","Escalate or recommend remediation when needed"]',
    '["Validation results are accurate","Public rationale stays bounded","Failures are visible"]',
    '["Must not expose internal reasoning","Must stay inside approved validation boundaries"]',
    'engineer'
  );

INSERT OR IGNORE INTO employee_visual_identity (
  employee_id,
  public_appearance_summary,
  birth_year,
  avatar_asset_url,
  visual_base_prompt,
  portrait_prompt
) VALUES
  (
    'emp_timeout_recovery_01',
    'Mid-30s, focused, operational, understated technical presence.',
    1991,
    NULL,
    'Professional infrastructure operator, focused, technical, calm, understated visual identity.',
    'Professional portrait of a focused infrastructure operator, calm, precise, understated technical aesthetic.'
  ),
  (
    'emp_retry_supervisor_01',
    'Late-30s, steady, methodical, reliability-oriented presence.',
    1988,
    NULL,
    'Professional reliability supervisor, composed, systems-minded, pragmatic visual identity.',
    'Professional portrait of a reliability supervisor, composed, methodical, understated operations aesthetic.'
  ),
  (
    'emp_infra_ops_manager_01',
    'Mid-40s, composed, managerial, high-trust operational presence.',
    1980,
    NULL,
    'Professional operations manager, composed, trusted, governance-oriented visual identity.',
    'Professional portrait of an infrastructure operations manager, composed, authoritative, modern technical organization aesthetic.'
  ),
  (
    'emp_pm_01',
    'Mid-40s, strategic, market-aware, structured leadership presence.',
    1982,
    NULL,
    'Professional product manager, strategic, composed, market-aware organizational visual identity.',
    'Professional portrait of a product manager, strategic, composed, business-aware, modern technical organization aesthetic.'
  ),
  (
    'emp_product_manager_web_01',
    'Early-40s, strategic, thoughtful, product-oriented presence.',
    1985,
    NULL,
    'Professional web product manager, strategic, thoughtful, modern product organization aesthetic.',
    'Professional portrait of a web product manager, strategic, thoughtful, composed, modern technical product aesthetic.'
  ),
  (
    'emp_frontend_engineer_01',
    'Early-30s, creative, implementation-focused, modern technical presence.',
    1994,
    NULL,
    'Professional frontend engineer, modern, implementation-focused, clean technical aesthetic.',
    'Professional portrait of a frontend engineer, modern, implementation-focused, calm technical aesthetic.'
  ),
  (
    'emp_validation_pm_01',
    'Early-40s, structured, analytical, validation-planning presence.',
    1984,
    NULL,
    'Professional validation PM, analytical, structured, composed organization aesthetic.',
    'Professional portrait of a validation PM, structured, analytical, composed technical organization aesthetic.'
  ),
  (
    'emp_validation_engineer_01',
    'Mid-30s, analytical, detail-oriented, validation-focused presence.',
    1990,
    NULL,
    'Professional validation engineer, analytical, detail-oriented, technical quality aesthetic.',
    'Professional portrait of a validation engineer, analytical, precise, understated quality engineering aesthetic.'
  ),
  (
    'emp_val_specialist_01',
    'Mid-30s, precise, reliability-focused, quietly intense technical presence.',
    1992,
    NULL,
    'Professional site reliability engineer, precise, reliability-focused, calm but intense operations aesthetic.',
    'Professional portrait of a site reliability engineer, precise, reliability-focused, calm technical operations aesthetic.'
  );

INSERT OR IGNORE INTO employee_employment_events (
  event_id,
  employee_id,
  event_type,
  to_team_id,
  to_role_id,
  effective_at,
  reason,
  approved_by
) VALUES
  ('evt_hire_emp_timeout_recovery_01', 'emp_timeout_recovery_01', 'hired', 'team_infra', 'timeout-recovery-operator', '2026-04-02T00:00:00.000Z', 'Initial org catalog seed', 'system'),
  ('evt_hire_emp_retry_supervisor_01', 'emp_retry_supervisor_01', 'hired', 'team_infra', 'retry-supervisor', '2026-04-02T00:00:00.000Z', 'Initial org catalog seed', 'system'),
  ('evt_hire_emp_infra_ops_manager_01', 'emp_infra_ops_manager_01', 'hired', 'team_infra', 'infra-ops-manager', '2026-04-02T00:00:00.000Z', 'Initial org catalog seed', 'system'),
  ('evt_hire_emp_pm_01', 'emp_pm_01', 'hired', 'team_infra', 'product-manager', '2026-04-02T00:00:00.000Z', 'Initial org catalog seed', 'system'),
  ('evt_hire_emp_product_manager_web_01', 'emp_product_manager_web_01', 'hired', 'team_web_product', 'product-manager-web', '2026-04-02T00:00:00.000Z', 'Initial org catalog seed', 'system'),
  ('evt_hire_emp_frontend_engineer_01', 'emp_frontend_engineer_01', 'hired', 'team_web_product', 'frontend-engineer', '2026-04-02T00:00:00.000Z', 'Initial org catalog seed', 'system'),
  ('evt_hire_emp_validation_pm_01', 'emp_validation_pm_01', 'hired', 'team_validation', 'validation-pm', '2026-04-02T00:00:00.000Z', 'Initial org catalog seed', 'system'),
  ('evt_hire_emp_validation_engineer_01', 'emp_validation_engineer_01', 'hired', 'team_validation', 'validation-engineer', '2026-04-02T00:00:00.000Z', 'Initial org catalog seed', 'system'),
  ('evt_hire_emp_val_specialist_01', 'emp_val_specialist_01', 'hired', 'team_validation', 'reliability-engineer', '2026-04-05T00:00:00.000Z', 'Validation specialist catalog seed', 'system');