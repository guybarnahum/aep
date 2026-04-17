import type {
  EmployeePromptProfile,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type EmployeePromptProfileRow = {
  employee_id: string;
  base_prompt: string;
  decision_style: string | null;
  collaboration_style: string | null;
  identity_seed: string | null;
  portrait_prompt: string | null;
  prompt_version: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }
  return env.OPERATOR_AGENT_DB;
}

function rowToEmployeePromptProfile(
  row: EmployeePromptProfileRow,
): EmployeePromptProfile {
  return {
    employeeId: row.employee_id,
    basePrompt: row.base_prompt,
    decisionStyle: row.decision_style ?? undefined,
    collaborationStyle: row.collaboration_style ?? undefined,
    identitySeed: row.identity_seed ?? undefined,
    portraitPrompt: row.portrait_prompt ?? undefined,
    promptVersion: row.prompt_version,
    status: row.status === "approved" ? "approved" : "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getEmployeePromptProfile(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeePromptProfile | null> {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT
         employee_id,
         base_prompt,
         decision_style,
         collaboration_style,
         identity_seed,
         portrait_prompt,
         prompt_version,
         status,
         created_at,
         updated_at
       FROM employee_prompt_profiles
       WHERE employee_id = ?
       LIMIT 1`,
    )
    .bind(employeeId)
    .first<EmployeePromptProfileRow>();

  return row ? rowToEmployeePromptProfile(row) : null;
}