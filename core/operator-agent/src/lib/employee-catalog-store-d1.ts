import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export interface EmployeeCatalogRow {
  employeeId: string;
  companyId: string;
  teamId: string;
  employeeName: string;
  roleId: string;
  status: string;
  schedulerMode: string;
  createdAt: string;
  updatedAt: string;
}

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function rowToEmployeeCatalogRow(row: {
  id: string;
  company_id: string;
  team_id: string;
  employee_name: string;
  role_id: string;
  status: string;
  scheduler_mode: string;
  created_at: string;
  updated_at: string;
}): EmployeeCatalogRow {
  return {
    employeeId: row.id,
    companyId: row.company_id,
    teamId: row.team_id,
    employeeName: row.employee_name,
    roleId: row.role_id,
    status: row.status,
    schedulerMode: row.scheduler_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEmployeeCatalog(
  env: OperatorAgentEnv,
  filters?: {
    companyId?: string;
    teamId?: string;
    status?: string;
  },
): Promise<EmployeeCatalogRow[]> {
  const db = requireDb(env);

  const clauses: string[] = [];
  const bindings: string[] = [];

  if (filters?.companyId) {
    clauses.push("company_id = ?");
    bindings.push(filters.companyId);
  }

  if (filters?.teamId) {
    clauses.push("team_id = ?");
    bindings.push(filters.teamId);
  }

  if (filters?.status) {
    clauses.push("status = ?");
    bindings.push(filters.status);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = await db
    .prepare(
      `SELECT
         id,
         company_id,
         team_id,
         employee_name,
         role_id,
         status,
         scheduler_mode,
         created_at,
         updated_at
       FROM employees_catalog
       ${where}
       ORDER BY id`,
    )
    .bind(...bindings)
    .all<{
      id: string;
      company_id: string;
      team_id: string;
      employee_name: string;
      role_id: string;
      status: string;
      scheduler_mode: string;
      created_at: string;
      updated_at: string;
    }>();

  return (rows.results ?? []).map(rowToEmployeeCatalogRow);
}

export async function getEmployeeCatalogEntry(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeeCatalogRow | null> {
  const db = requireDb(env);

  const row = await db
    .prepare(
      `SELECT
         id,
         company_id,
         team_id,
         employee_name,
         role_id,
         status,
         scheduler_mode,
         created_at,
         updated_at
       FROM employees_catalog
       WHERE id = ?
       LIMIT 1`,
    )
    .bind(employeeId)
    .first<{
      id: string;
      company_id: string;
      team_id: string;
      employee_name: string;
      role_id: string;
      status: string;
      scheduler_mode: string;
      created_at: string;
      updated_at: string;
    }>();

  return row ? rowToEmployeeCatalogRow(row) : null;
}