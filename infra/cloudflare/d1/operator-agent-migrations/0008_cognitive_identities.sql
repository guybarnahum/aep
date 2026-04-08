-- 0. Ensure the Company exists (required for FK on teams and employees)
INSERT OR IGNORE INTO companies (id, slug, name, status, created_at, updated_at)
VALUES (
  'company_internal_aep',
  'internal-aep',
  'AEP Internal',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);


-- 1. Ensure the Teams exist with required schema columns
INSERT OR IGNORE INTO teams (id, company_id, slug, name, kind, status, created_at, updated_at)
VALUES (
  'team_validation', 
  'company_internal_aep', 
  'validation', 
  'Validation Team', 
  'engineering', 
  'active', 
  CURRENT_TIMESTAMP, 
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO teams (id, company_id, slug, name, kind, status, created_at, updated_at)
VALUES (
  'team_infra', 
  'company_internal_aep', 
  'infrastructure', 
  'Infrastructure Team', 
  'engineering', 
  'active', 
  CURRENT_TIMESTAMP, 
  CURRENT_TIMESTAMP
);

-- 2. Hire the base Employees into the catalog

INSERT OR IGNORE INTO employees_catalog (id, company_id, team_id, employee_name, role_id, status, scheduler_mode, created_at, updated_at)
VALUES ('emp_val_specialist_01', 'company_internal_aep', 'team_validation', 'Sia', 'reliability-engineer', 'active', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO employees_catalog (id, company_id, team_id, employee_name, role_id, status, scheduler_mode, created_at, updated_at)
VALUES ('emp_pm_01', 'company_internal_aep', 'team_infra', 'Marcus', 'product-manager', 'active', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);


-- 1. Employee Personas (The "Who")
CREATE TABLE IF NOT EXISTS employee_personas (
  employee_id TEXT PRIMARY KEY,
  bio TEXT NOT NULL,
  tone TEXT NOT NULL, -- e.g., "Professional", "Analytical", "Witty"
  skills_json TEXT NOT NULL, -- JSON array of core competencies
  photo_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees_catalog(id)
);

-- 2. Team Roadmaps (The "Why")
CREATE TABLE IF NOT EXISTS team_roadmaps (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  objective_title TEXT NOT NULL,
  strategic_context TEXT,
  priority INTEGER DEFAULT 1, -- 1-5 scale
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. Seed Sia (Reliability Engineer)
INSERT OR IGNORE INTO employee_personas (employee_id, bio, tone, skills_json)
VALUES (
  'emp_val_specialist_01',
  'Obsessive about platform integrity. Sia treats every 500 error as a personal challenge. She values data over intuition.',
  'Analytical and precise',
  '["Failure Mode Analysis", "Substrate Health", "D1 Schema Optimization"]'
);

-- 4. Seed Marcus (Product Manager)
-- Note: Assuming Marcus ID 'emp_pm_01' exists or will be added to catalog
INSERT OR IGNORE INTO employee_personas (employee_id, bio, tone, skills_json)
VALUES (
  'emp_pm_01',
  'A market-focused strategist who analyzes competitor trends to keep AEP at the cutting edge. Marcus maps business goals to technical tasks.',
  'Visionary and Strategic',
  '["Competitive Analysis", "Roadmap Prioritization", "Feature Spec Design"]'
);
