import type {
  AgentAuthority,
  AgentBudget,
  EscalationPolicy,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export interface RuntimeRolePolicyRecord {
  roleId: string;
  authority: AgentAuthority;
  budget: AgentBudget;
  escalation: EscalationPolicy;
}

type RuntimeRolePolicyRow = {
  role_id: string;
  authority_json: string;
  budget_json: string;
  escalation_json: string;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

function parseJsonObject<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Invalid ${label} JSON in runtime_role_policies`);
  }
}

function rowToRecord(row: RuntimeRolePolicyRow): RuntimeRolePolicyRecord {
  return {
    roleId: row.role_id,
    authority: parseJsonObject<AgentAuthority>(row.authority_json, "authority"),
    budget: parseJsonObject<AgentBudget>(row.budget_json, "budget"),
    escalation: parseJsonObject<EscalationPolicy>(row.escalation_json, "escalation"),
  };
}

export async function getRuntimeRolePolicy(
  env: OperatorAgentEnv,
  roleId: string,
): Promise<RuntimeRolePolicyRecord | null> {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT role_id, authority_json, budget_json, escalation_json
       FROM runtime_role_policies
       WHERE role_id = ?
       LIMIT 1`,
    )
    .bind(roleId)
    .first<RuntimeRolePolicyRow>();

  return row ? rowToRecord(row) : null;
}

export async function listRuntimeRolePolicies(
  env: OperatorAgentEnv,
): Promise<RuntimeRolePolicyRecord[]> {
  const db = requireDb(env);
  const rows = await db
    .prepare(
      `SELECT role_id, authority_json, budget_json, escalation_json
       FROM runtime_role_policies
       ORDER BY role_id`,
    )
    .all<RuntimeRolePolicyRow>();

  return (rows.results ?? []).map(rowToRecord);
}