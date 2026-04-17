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

export async function upsertEmployeePromptProfile(
  env: OperatorAgentEnv,
  profile: {
    employeeId: string;
    basePrompt: string;
    decisionStyle?: string;
    collaborationStyle?: string;
    identitySeed?: string;
    portraitPrompt?: string;
    promptVersion: string;
    status: "draft" | "approved";
  },
): Promise<void> {
  const db = requireDb(env);
  const existing = await getEmployeePromptProfile(env, profile.employeeId);

  await db
    .prepare(
      `INSERT INTO employee_prompt_profiles (
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(employee_id) DO UPDATE SET
         base_prompt = excluded.base_prompt,
         decision_style = excluded.decision_style,
         collaboration_style = excluded.collaboration_style,
         identity_seed = excluded.identity_seed,
         portrait_prompt = excluded.portrait_prompt,
         prompt_version = excluded.prompt_version,
         status = excluded.status,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      profile.employeeId,
      profile.basePrompt,
      profile.decisionStyle ?? existing?.decisionStyle ?? null,
      profile.collaborationStyle ?? existing?.collaborationStyle ?? null,
      profile.identitySeed ?? existing?.identitySeed ?? null,
      profile.portraitPrompt ?? existing?.portraitPrompt ?? null,
      profile.promptVersion,
      profile.status,
    )
    .run();
}

export async function approveEmployeePromptProfile(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeePromptProfile> {
  const db = requireDb(env);
  const existing = await getEmployeePromptProfile(env, employeeId);

  if (!existing) {
    throw new Error(`Prompt profile not found for ${employeeId}`);
  }

  await db
    .prepare(
      `UPDATE employee_prompt_profiles
       SET status = 'approved',
           updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
    )
    .bind(employeeId)
    .run();

  const approved = await getEmployeePromptProfile(env, employeeId);
  if (!approved) {
    throw new Error(`Prompt profile disappeared for ${employeeId}`);
  }

  return approved;
}