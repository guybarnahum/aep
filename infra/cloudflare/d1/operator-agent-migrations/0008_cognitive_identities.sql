-- Migration: 0008_cognitive_identities.sql
-- Goal: Seed the "Personality" and "Strategy" for the Agentic Organization.

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
