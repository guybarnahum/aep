import type {
  OperatorAgentEnv,
  RoleJobDescriptionProjection,
} from "@aep/operator-agent/types";

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

type RoleCatalogRow = {
  role_id: RoleJobDescriptionProjection["roleId"];
  title: string;
  team_id: RoleJobDescriptionProjection["teamId"];
  job_description_text: string;
  responsibilities_json: string;
  success_metrics_json: string;
  constraints_json: string;
  seniority_level: string;
};

type RoleReviewDimensionRow = {
  role_id: RoleJobDescriptionProjection["roleId"];
  dimension_key: string;
  label: string;
  description: string;
  weight: number | string;
};

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function rowToRoleProjection(
  row: RoleCatalogRow,
  reviewDimensions?: RoleJobDescriptionProjection["reviewDimensions"],
): RoleJobDescriptionProjection {
  return {
    roleId: row.role_id,
    title: row.title,
    teamId: row.team_id,
    jobDescriptionText: row.job_description_text,
    responsibilities: parseStringArray(row.responsibilities_json),
    successMetrics: parseStringArray(row.success_metrics_json),
    constraints: parseStringArray(row.constraints_json),
    seniorityLevel: row.seniority_level,
    reviewDimensions,
  };
}

async function getRoleReviewDimensionsMap(
  env: OperatorAgentEnv,
  roleIds: string[],
): Promise<Record<string, RoleJobDescriptionProjection["reviewDimensions"]>> {
  if (roleIds.length === 0) {
    return {};
  }

  const db = requireDb(env);
  const placeholders = roleIds.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT
         role_id,
         dimension_key,
         label,
         description,
         weight
       FROM role_review_dimensions
       WHERE role_id IN (${placeholders})
       ORDER BY role_id, dimension_key`,
    )
    .bind(...roleIds)
    .all<RoleReviewDimensionRow>();

  const out: Record<string, NonNullable<RoleJobDescriptionProjection["reviewDimensions"]>> = {};
  for (const row of rows.results ?? []) {
    if (!out[row.role_id]) {
      out[row.role_id] = [];
    }
    out[row.role_id].push({
      key: row.dimension_key,
      label: row.label,
      description: row.description,
      weight:
        typeof row.weight === "number"
          ? row.weight
          : Number.parseFloat(String(row.weight)),
    });
  }

  return out;
}

export async function listRoleCatalog(
  env: OperatorAgentEnv,
  filters?: {
    teamId?: string;
  },
): Promise<RoleJobDescriptionProjection[]> {
  const db = requireDb(env);
  const clauses: string[] = [];
  const bindings: string[] = [];

  if (filters?.teamId) {
    clauses.push("team_id = ?");
    bindings.push(filters.teamId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = await db
    .prepare(
      `SELECT
         role_id,
         title,
         team_id,
         job_description_text,
         responsibilities_json,
         success_metrics_json,
         constraints_json,
         seniority_level
       FROM roles_catalog
       ${where}
       ORDER BY team_id, title`,
    )
    .bind(...bindings)
    .all<RoleCatalogRow>();

  const roleIds = (rows.results ?? []).map((row) => row.role_id);
  const reviewDimensionsMap = await getRoleReviewDimensionsMap(env, roleIds);

  return (rows.results ?? []).map((row) =>
    rowToRoleProjection(row, reviewDimensionsMap[row.role_id]),
  );
}

export async function getRoleCatalogEntry(
  env: OperatorAgentEnv,
  roleId: string,
): Promise<RoleJobDescriptionProjection | null> {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT
         role_id,
         title,
         team_id,
         job_description_text,
         responsibilities_json,
         success_metrics_json,
         constraints_json,
         seniority_level
       FROM roles_catalog
       WHERE role_id = ?
       LIMIT 1`,
    )
    .bind(roleId)
    .first<RoleCatalogRow>();

  if (!row) {
    return null;
  }

  const reviewDimensionsMap = await getRoleReviewDimensionsMap(env, [roleId]);
  return rowToRoleProjection(row, reviewDimensionsMap[roleId]);
}