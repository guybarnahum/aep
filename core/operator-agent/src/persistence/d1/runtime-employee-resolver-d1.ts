import {
  buildRuntimeEmployeeDefinition,
  getRuntimeRoleProfile,
} from "@aep/operator-agent/org/employees";
import type { CompanyId } from "@aep/operator-agent/org/company";
import type { TeamId } from "@aep/operator-agent/org/teams";
import type {
  AgentEmployeeDefinition,
  AgentRoleId,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type RuntimeEmployeeRow = {
  employee_id: string;
  employee_name: string;
  company_id: string;
  team_id: string;
  role_id: string;
  manager_role_id?: string | null;
  created_at?: string;
  is_synthetic?: number | string | null;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

function rowToRuntimeEmployee(
  row: RuntimeEmployeeRow,
): AgentEmployeeDefinition | undefined {
  const roleId = row.role_id as AgentRoleId;

  if (!getRuntimeRoleProfile(roleId)) {
    return undefined;
  }

  return buildRuntimeEmployeeDefinition({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    companyId: row.company_id as CompanyId,
    teamId: row.team_id as TeamId,
    roleId,
    managerRoleId: row.manager_role_id as AgentRoleId | undefined,
  });
}

function runtimeEmployeeBaseQuery(whereClause: string): string {
  return `SELECT
      e.id AS employee_id,
      e.employee_name,
      e.company_id,
      e.team_id,
      e.role_id,
      r.manager_role_id,
      e.created_at,
      e.is_synthetic
    FROM employees_catalog e
    INNER JOIN roles_catalog r
      ON r.role_id = e.role_id
    WHERE ${whereClause}
      AND e.status = 'active'
      AND e.employment_status = 'active'
      AND r.runtime_enabled = 1
    ORDER BY
      CASE
        WHEN e.is_synthetic = 1 OR e.is_synthetic = '1' THEN 1
        ELSE 0
      END,
      e.created_at,
      e.id`;
}

export async function resolveRuntimeEmployeeById(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<AgentEmployeeDefinition | undefined> {
  const db = requireDb(env);
  const row = await db
    .prepare(runtimeEmployeeBaseQuery("e.id = ?"))
    .bind(employeeId)
    .first<RuntimeEmployeeRow>();

  return row ? rowToRuntimeEmployee(row) : undefined;
}

export async function resolveRuntimeEmployeeByRole(args: {
  env: OperatorAgentEnv;
  companyId?: CompanyId;
  teamId?: TeamId;
  roleId: AgentRoleId;
}): Promise<AgentEmployeeDefinition | undefined> {
  if (!getRuntimeRoleProfile(args.roleId)) {
    return undefined;
  }

  const db = requireDb(args.env);
  const clauses = ["e.role_id = ?"];
  const bindings: string[] = [args.roleId];

  if (args.companyId) {
    clauses.push("e.company_id = ?");
    bindings.push(args.companyId);
  }

  if (args.teamId) {
    clauses.push("e.team_id = ?");
    bindings.push(args.teamId);
  }

  const row = await db
    .prepare(runtimeEmployeeBaseQuery(clauses.join(" AND ")))
    .bind(...bindings)
    .first<RuntimeEmployeeRow>();

  return row ? rowToRuntimeEmployee(row) : undefined;
}

export async function resolveRuntimeEmployeeIdsByRoles(args: {
  env: OperatorAgentEnv;
  companyId?: CompanyId;
  teamId?: TeamId;
  roleIds: AgentRoleId[];
}): Promise<string[]> {
  const uniqueRoleIds = [...new Set(args.roleIds)].filter((roleId) =>
    Boolean(getRuntimeRoleProfile(roleId)),
  );

  if (uniqueRoleIds.length === 0) {
    return [];
  }

  const db = requireDb(args.env);
  const bindings: string[] = [...uniqueRoleIds];
  const rolePlaceholders = uniqueRoleIds.map(() => "?").join(", ");
  const clauses = [`e.role_id IN (${rolePlaceholders})`];

  if (args.companyId) {
    clauses.push("e.company_id = ?");
    bindings.push(args.companyId);
  }

  if (args.teamId) {
    clauses.push("e.team_id = ?");
    bindings.push(args.teamId);
  }

  const rows = await db
    .prepare(runtimeEmployeeBaseQuery(clauses.join(" AND ")))
    .bind(...bindings)
    .all<RuntimeEmployeeRow>();

  const selectedByRole = new Map<AgentRoleId, string>();
  for (const row of rows.results ?? []) {
    const roleId = row.role_id as AgentRoleId;
    if (!selectedByRole.has(roleId)) {
      selectedByRole.set(roleId, row.employee_id);
    }
  }

  return uniqueRoleIds
    .map((roleId) => selectedByRole.get(roleId))
    .filter((employeeId): employeeId is string => typeof employeeId === "string");
}