import type {
  EmployeePublicLink,
  EmployeePublicLinkType,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export interface EmployeeCatalogRow {
  employeeId: string;
  companyId: string;
  teamId: string;
  employeeName: string;
  roleId: string;
  status: string;
  employmentStatus: string;
  schedulerMode: string;
  isSynthetic?: boolean;
  // Cognitive Additions
  bio?: string;
  tone?: string;
  skillsJson?: string;
  photoUrl?: string;
  appearanceSummary?: string;
  birthYear?: number;
  createdAt: string;
  updatedAt: string;
}

type EmployeePublicLinkRow = {
  employee_id: string;
  link_type: string;
  url: string;
  is_verified: number | string;
  visibility: string;
};

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
  employment_status: string;
  scheduler_mode: string;
  is_synthetic?: number | string | null;
  bio?: string | null;
  tone?: string | null;
  skills_json?: string | null;
  avatar_url?: string | null;
  public_appearance_summary?: string | null;
  birth_year?: number | string | null;
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
    employmentStatus: row.employment_status,
    schedulerMode: row.scheduler_mode,
    isSynthetic:
      row.is_synthetic === 1 || row.is_synthetic === "1"
        ? true
        : row.is_synthetic === 0 || row.is_synthetic === "0"
          ? false
          : undefined,
    bio: row.bio ?? undefined,
    tone: row.tone ?? undefined,
    skillsJson: row.skills_json ?? undefined,
    photoUrl: row.avatar_url ?? undefined,
    appearanceSummary: row.public_appearance_summary ?? undefined,
    birthYear:
      typeof row.birth_year === "number"
        ? row.birth_year
        : typeof row.birth_year === "string" && row.birth_year.length > 0
          ? Number.parseInt(row.birth_year, 10)
          : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizePublicLinkType(value: string): EmployeePublicLinkType {
  switch (value) {
    case "github":
    case "linkedin":
    case "website":
    case "x":
    case "portfolio":
      return value;
    default:
      return "website";
  }
}

export async function listEmployeeCatalog(
  env: OperatorAgentEnv,
  filters?: {
    companyId?: string;
    teamId?: string;
    status?: string;
    employmentStatus?: string;
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

  if (filters?.employmentStatus) {
    clauses.push("employment_status = ?");
    bindings.push(filters.employmentStatus);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = await db
    .prepare(
      `SELECT
         e.id,
         e.company_id,
         e.team_id,
         e.employee_name,
         e.role_id,
         e.status,
         e.employment_status,
         e.scheduler_mode,
         p.bio,
         p.tone,
         p.skills_json,
         COALESCE(v.avatar_asset_url, p.photo_url) AS avatar_url,
         v.public_appearance_summary,
         v.birth_year,
         e.created_at,
         e.updated_at
       FROM employees_catalog e
       LEFT JOIN employee_personas p
         ON e.id = p.employee_id
       LEFT JOIN employee_visual_identity v
         ON e.id = v.employee_id
       ${where}
       ORDER BY e.id`,
    )
    .bind(...bindings)
    .all<{
      id: string;
      company_id: string;
      team_id: string;
      employee_name: string;
      role_id: string;
      status: string;
      employment_status: string;
      scheduler_mode: string;
      bio?: string | null;
      tone?: string | null;
      skills_json?: string | null;
      avatar_url?: string | null;
      public_appearance_summary?: string | null;
      birth_year?: number | string | null;
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
         e.id,
         e.company_id,
         e.team_id,
         e.employee_name,
         e.role_id,
         e.status,
         e.employment_status,
         e.scheduler_mode,
         e.created_at,
         e.updated_at,
         p.bio,
         p.tone,
         p.skills_json,
         COALESCE(v.avatar_asset_url, p.photo_url) AS avatar_url,
         v.public_appearance_summary,
         v.birth_year
       FROM employees_catalog e
       LEFT JOIN employee_personas p ON e.id = p.employee_id
       LEFT JOIN employee_visual_identity v ON e.id = v.employee_id
       WHERE e.id = ?
       LIMIT 1`,
    )
    .bind(employeeId)
    .first<any>(); // Cast to any for the join result

  if (!row) return null;

  return {
    ...rowToEmployeeCatalogRow(row),
    bio: row.bio,
    tone: row.tone,
    skillsJson: row.skills_json,
    photoUrl: row.avatar_url,
  };
}

export async function listEmployeePublicLinks(
  env: OperatorAgentEnv,
  employeeIds: string[],
): Promise<Record<string, EmployeePublicLink[]>> {
  if (employeeIds.length === 0) {
    return {};
  }

  const db = requireDb(env);
  const placeholders = employeeIds.map(() => "?").join(", ");

  const rows = await db
    .prepare(
      `SELECT
         employee_id,
         link_type,
         url,
         is_verified,
         visibility
       FROM employee_public_links
       WHERE employee_id IN (${placeholders})
       ORDER BY employee_id, link_type, url`,
    )
    .bind(...employeeIds)
    .all<EmployeePublicLinkRow>();

  const grouped: Record<string, EmployeePublicLink[]> = {};

  for (const row of rows.results ?? []) {
    if (!grouped[row.employee_id]) {
      grouped[row.employee_id] = [];
    }

    grouped[row.employee_id].push({
      type: normalizePublicLinkType(row.link_type),
      url: row.url,
      verified: String(row.is_verified) === "1",
      visibility: row.visibility === "org" ? "org" : "public",
    });
  }

  return grouped;
}