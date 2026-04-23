PRAGMA defer_foreign_keys = on;

DELETE FROM agent_work_log;
DELETE FROM approvals;
DELETE FROM decisions;
DELETE FROM employee_budget_counters;
DELETE FROM employee_control_history;
DELETE FROM employee_controls;
DELETE FROM employee_messages;
DELETE FROM escalations;
DELETE FROM job_cooldowns;
DELETE FROM manager_decisions;
DELETE FROM message_threads;
DELETE FROM task_artifacts;
DELETE FROM task_dependencies;
DELETE FROM tasks;
DELETE FROM team_roadmaps;
DELETE FROM _cf_KV;

PRAGMA optimize;