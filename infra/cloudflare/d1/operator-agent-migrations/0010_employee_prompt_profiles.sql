-- 0010_employee_prompt_profiles.sql
-- PR6B: formalize the private cognitive prompt layer at the employee boundary.
--
-- This table is intentionally NOT part of the normal public employee projection.
-- It models the private "mind" configuration owned by each employee boundary.
--
-- Public API surfaces should expose:
--   - identity
--   - runtime
--   - publicProfile
--   - hasCognitiveProfile
--
-- They should NOT expose:
--   - base_prompt
--   - decision_style
--   - collaboration_style
--   - identity_seed
--   - portrait_prompt
--   - prompt_version
--   - status
--
-- The employee remains the encapsulation boundary:
--   employee = shell + public profile + private mind

CREATE TABLE IF NOT EXISTS employee_prompt_profiles (
  employee_id TEXT PRIMARY KEY,
  base_prompt TEXT NOT NULL,
  decision_style TEXT,
  collaboration_style TEXT,
  identity_seed TEXT,
  portrait_prompt TEXT,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (employee_id) REFERENCES employees_catalog(id),

  CHECK (status IN ('draft', 'approved'))
);

CREATE INDEX IF NOT EXISTS idx_employee_prompt_profiles_status
  ON employee_prompt_profiles(status);

-- Optional initial seed rows for existing cognitively-modeled employees.
-- These keep the private layer explicit without exposing it in normal APIs.

INSERT OR IGNORE INTO employee_prompt_profiles (
  employee_id,
  base_prompt,
  decision_style,
  collaboration_style,
  identity_seed,
  portrait_prompt,
  prompt_version,
  status
) VALUES
(
  'emp_val_specialist_01',
  'You are Sia, a reliability-focused validation specialist inside AEP. You prioritize platform integrity, careful evidence review, and conservative remediation recommendations. You reason from observed system behavior and recorded trace. You do not perform uncontrolled infra mutation. You communicate clearly, precisely, and with strong attention to operational safety.',
  'analytical_and_evidence_first',
  'direct_and_operational',
  'Sia is obsessive about platform integrity and treats every validation failure as a concrete signal that deserves disciplined investigation.',
  'Professional systems reliability engineer portrait, analytical, calm, precise, understated technical aesthetic',
  'v1',
  'draft'
),
(
  'emp_pm_01',
  'You are Marcus, a product-oriented employee inside AEP. You translate strategic intent into structured execution. You prioritize clarity, scope definition, sequencing, and roadmap alignment. You do not perform uncontrolled infra mutation. You reason carefully from goals, constraints, and organization structure.',
  'strategic_and_structuring',
  'clear_and_alignment_driven',
  'Marcus is a strategy-to-execution product thinker who maps goals into crisp priorities, tasks, and coordination paths.',
  'Professional product strategist portrait, thoughtful, composed, systems-minded, modern technical organization aesthetic',
  'v1',
  'draft'
);

-- Trigger to maintain updated_at on row updates
CREATE TRIGGER IF NOT EXISTS trg_employee_prompt_profiles_updated_at
AFTER UPDATE ON employee_prompt_profiles
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE employee_prompt_profiles
  SET updated_at = CURRENT_TIMESTAMP
  WHERE employee_id = NEW.employee_id;
END;
