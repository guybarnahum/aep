import type { OperatorAgentEnv } from "@aep/operator-agent/types";

export interface EmployeeScopeBinding {
  bindingId: string;
  employeeId: string;
  tenantId: string | null;
  serviceId: string | null;
  environmentName: string | null;
  createdAt: string;
}

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

export async function listEmployeeScopeBindings(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeeScopeBinding[]> {
  const db = requireDb(env);
  const rows = await db
    .prepare(
      `SELECT
         binding_id,
         employee_id,
         tenant_id,
         service_id,
         environment_name,
         created_at
       FROM employee_scope_bindings
       WHERE employee_id = ?
       ORDER BY binding_id`,
    )
    .bind(employeeId)
    .all<{
      binding_id: string;
      employee_id: string;
      tenant_id: string | null;
      service_id: string | null;
      environment_name: string | null;
      created_at: string;
    }>();

  return (rows.results ?? []).map((row) => ({
    bindingId: row.binding_id,
    employeeId: row.employee_id,
    tenantId: row.tenant_id,
    serviceId: row.service_id,
    environmentName: row.environment_name,
    createdAt: row.created_at,
  }));
}

export async function resolveAllowedScope(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<{
  allowedTenants: string[];
  allowedServices: string[];
  allowedEnvironmentNames: string[];
  bindings: EmployeeScopeBinding[];
}> {
  const bindings = await listEmployeeScopeBindings(env, employeeId);

  return {
    allowedTenants: [
      ...new Set(bindings.map((binding) => binding.tenantId).filter(Boolean)),
    ] as string[],
    allowedServices: [
      ...new Set(bindings.map((binding) => binding.serviceId).filter(Boolean)),
    ] as string[],
    allowedEnvironmentNames: [
      ...new Set(
        bindings.map((binding) => binding.environmentName).filter(Boolean),
      ),
    ] as string[],
    bindings,
  };
}