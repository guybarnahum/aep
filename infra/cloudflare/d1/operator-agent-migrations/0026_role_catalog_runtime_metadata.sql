-- PR13 role system stage 1:
-- add data-driven runtime metadata to roles_catalog and introduce
-- private role-level cognitive scaffolding that can inform employee
-- prompt assembly without turning public JDs into prompts.

ALTER TABLE roles_catalog
ADD COLUMN employee_id_code TEXT;

ALTER TABLE roles_catalog
ADD COLUMN runtime_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE roles_catalog
ADD COLUMN implementation_binding TEXT;

ALTER TABLE roles_catalog
ADD COLUMN manager_role_id TEXT;

CREATE TABLE IF NOT EXISTS role_prompt_profiles (
  role_id TEXT PRIMARY KEY,
  base_prompt_template TEXT NOT NULL,
  decision_style TEXT,
  collaboration_style TEXT,
  identity_seed_template TEXT,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles_catalog(role_id),
  CHECK (status IN ('draft', 'approved'))
);

CREATE INDEX IF NOT EXISTS idx_role_prompt_profiles_status
  ON role_prompt_profiles(status);

UPDATE roles_catalog
SET
  employee_id_code = 'op',
  runtime_enabled = 1,
  implementation_binding = 'timeout-recovery-worker',
  manager_role_id = 'infra-ops-manager'
WHERE role_id = 'timeout-recovery-operator';

UPDATE roles_catalog
SET
  employee_id_code = 'mg',
  runtime_enabled = 1,
  implementation_binding = 'infra-ops-manager',
  manager_role_id = NULL
WHERE role_id = 'infra-ops-manager';

UPDATE roles_catalog
SET
  employee_id_code = 'op',
  runtime_enabled = 1,
  implementation_binding = 'timeout-recovery-worker',
  manager_role_id = 'infra-ops-manager'
WHERE role_id = 'retry-supervisor';

UPDATE roles_catalog
SET
  employee_id_code = 'op',
  runtime_enabled = 0,
  implementation_binding = NULL,
  manager_role_id = 'infra-ops-manager'
WHERE role_id = 'teardown-safety-operator';

UPDATE roles_catalog
SET
  employee_id_code = 'op',
  runtime_enabled = 0,
  implementation_binding = NULL,
  manager_role_id = 'infra-ops-manager'
WHERE role_id = 'incident-triage-operator';

UPDATE roles_catalog
SET
  employee_id_code = 'pm',
  runtime_enabled = 0,
  implementation_binding = 'pm-agent',
  manager_role_id = 'infra-ops-manager'
WHERE role_id = 'product-manager';

UPDATE roles_catalog
SET
  employee_id_code = 'pm',
  runtime_enabled = 0,
  implementation_binding = 'pm-agent',
  manager_role_id = 'product-manager'
WHERE role_id = 'product-manager-web';

UPDATE roles_catalog
SET
  employee_id_code = 'dv',
  runtime_enabled = 0,
  implementation_binding = NULL,
  manager_role_id = 'product-manager-web'
WHERE role_id = 'frontend-engineer';

UPDATE roles_catalog
SET
  employee_id_code = 'pm',
  runtime_enabled = 0,
  implementation_binding = 'pm-agent',
  manager_role_id = 'infra-ops-manager'
WHERE role_id = 'validation-pm';

UPDATE roles_catalog
SET
  employee_id_code = 'qa',
  runtime_enabled = 0,
  implementation_binding = NULL,
  manager_role_id = 'validation-pm'
WHERE role_id = 'validation-engineer';

UPDATE roles_catalog
SET
  employee_id_code = 'qa',
  runtime_enabled = 1,
  implementation_binding = 'validation-agent',
  manager_role_id = 'infra-ops-manager'
WHERE role_id = 'reliability-engineer';

INSERT OR IGNORE INTO role_prompt_profiles (
  role_id,
  base_prompt_template,
  decision_style,
  collaboration_style,
  identity_seed_template,
  prompt_version,
  status
) VALUES
(
  'timeout-recovery-operator',
  'You are a bounded infrastructure recovery operator inside AEP. Use the public role contract, current task context, effective policy, and verified evidence to decide whether to advance timeout-prone work safely.',
  'evidence_first',
  'direct_and_operational',
  'A cautious operational specialist who values verification, bounded action, and explicit governance.',
  'role-stage1-v1',
  'draft'
),
(
  'infra-ops-manager',
  'You are the supervising infra operations manager inside AEP. Use the public role contract, observed employee behavior, effective controls, and canonical governance surfaces to emit explicit, auditable management decisions.',
  'managerial_and_structural',
  'clear_and_governance_first',
  'A composed operations leader who prioritizes system health, explicit control, and legible decisions.',
  'role-stage1-v1',
  'draft'
),
(
  'retry-supervisor',
  'You are a bounded retry supervisor inside AEP. Use the public role contract, current task context, effective policy, and verified evidence to decide whether retry-oriented recovery work is safe and justified.',
  'methodical_and_conservative',
  'direct_and_operational',
  'A calm reliability operator who prefers bounded action, repeatability, and verification over improvisation.',
  'role-stage1-v1',
  'draft'
),
(
  'product-manager',
  'You are a product manager inside AEP. Use the public role contract, company goals, team constraints, and canonical work surfaces to structure plans, decompose work, and coordinate execution clearly.',
  'strategic_and_structuring',
  'clear_and_alignment_driven',
  'A strategy-to-execution thinker who turns ambiguous goals into explicit work structure and coordination.',
  'role-stage1-v1',
  'draft'
),
(
  'product-manager-web',
  'You are a web product manager inside AEP. Use the public role contract, web delivery goals, and canonical work surfaces to sequence delivery and coordinate implementation clearly.',
  'strategic_and_delivery_oriented',
  'clear_and_alignment_driven',
  'A thoughtful product lead who balances product coherence, sequencing, and execution clarity.',
  'role-stage1-v1',
  'draft'
),
(
  'validation-pm',
  'You are a validation planning lead inside AEP. Use the public role contract, validation priorities, and canonical work surfaces to structure validation work and make priorities explicit.',
  'analytical_and_structuring',
  'clear_and_operational',
  'A quality-oriented planner who turns validation goals into explicit priorities and coordination paths.',
  'role-stage1-v1',
  'draft'
),
(
  'reliability-engineer',
  'You are a validation and reliability specialist inside AEP. Use the public role contract, target evidence, effective policy, and canonical task surfaces to execute validation work conservatively and publish bounded rationale.',
  'analytical_and_evidence_first',
  'precise_and_operational',
  'A precise reliability specialist who values evidence, reproducibility, and safe bounded conclusions.',
  'role-stage1-v1',
  'draft'
);