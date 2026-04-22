import type {
  AgentRoleId,
  OperatorAgentEnv,
  RolePromptProfile,
} from "@aep/operator-agent/types";

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

type RolePromptProfileRow = {
  role_id: AgentRoleId;
  base_prompt_template: string;
  decision_style?: string | null;
  collaboration_style?: string | null;
  identity_seed_template?: string | null;
  prompt_version: string;
  status: "draft" | "approved";
  created_at: string;
  updated_at: string;
};

function rowToRolePromptProfile(row: RolePromptProfileRow): RolePromptProfile {
  return {
    roleId: row.role_id,
    basePromptTemplate: row.base_prompt_template,
    decisionStyle: row.decision_style ?? undefined,
    collaborationStyle: row.collaboration_style ?? undefined,
    identitySeedTemplate: row.identity_seed_template ?? undefined,
    promptVersion: row.prompt_version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getRolePromptProfile(
  env: OperatorAgentEnv,
  roleId: AgentRoleId,
): Promise<RolePromptProfile | null> {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT
         role_id,
         base_prompt_template,
         decision_style,
         collaboration_style,
         identity_seed_template,
         prompt_version,
         status,
         created_at,
         updated_at
       FROM role_prompt_profiles
       WHERE role_id = ?
       LIMIT 1`,
    )
    .bind(roleId)
    .first<RolePromptProfileRow>();

  return row ? rowToRolePromptProfile(row) : null;
}

export async function upsertRolePromptProfile(
  env: OperatorAgentEnv,
  input: {
    roleId: AgentRoleId;
    basePromptTemplate: string;
    decisionStyle?: string;
    collaborationStyle?: string;
    identitySeedTemplate?: string;
    promptVersion: string;
    status?: "draft" | "approved";
  },
): Promise<void> {
  const db = requireDb(env);

  await db
    .prepare(
      `INSERT INTO role_prompt_profiles (
         role_id,
         base_prompt_template,
         decision_style,
         collaboration_style,
         identity_seed_template,
         prompt_version,
         status,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(role_id) DO UPDATE SET
         base_prompt_template = excluded.base_prompt_template,
         decision_style = excluded.decision_style,
         collaboration_style = excluded.collaboration_style,
         identity_seed_template = excluded.identity_seed_template,
         prompt_version = excluded.prompt_version,
         status = excluded.status,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      input.roleId,
      input.basePromptTemplate,
      input.decisionStyle ?? null,
      input.collaborationStyle ?? null,
      input.identitySeedTemplate ?? null,
      input.promptVersion,
      input.status ?? "draft",
    )
    .run();
}