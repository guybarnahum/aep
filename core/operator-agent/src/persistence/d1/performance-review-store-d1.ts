import type {
  EmployeePerformanceRecommendation,
  EmployeePerformanceReviewEvidence,
  EmployeePerformanceReviewRecord,
  EmployeeReviewCycleRecord,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

function requireDb(env: OperatorAgentEnv): D1Database {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return env.OPERATOR_AGENT_DB;
}

type ReviewCycleRow = {
  review_cycle_id: string;
  company_id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: "draft" | "active" | "closed";
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PerformanceReviewRow = {
  review_id: string;
  review_cycle_id: string;
  employee_id: string;
  role_id: string;
  team_id: string;
  summary: string;
  strengths_json: string;
  gaps_json: string;
  dimension_scores_json: string;
  recommendations_json: string;
  created_by?: string | null;
  approved_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ReviewEvidenceRow = {
  review_id: string;
  evidence_type: "task" | "artifact" | "thread";
  evidence_id: string;
};

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function rowToReviewCycle(row: ReviewCycleRow): EmployeeReviewCycleRecord {
  return {
    reviewCycleId: row.review_cycle_id,
    companyId: row.company_id as EmployeeReviewCycleRecord["companyId"],
    name: row.name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function rowToPerformanceReview(
  row: PerformanceReviewRow,
  evidence: EmployeePerformanceReviewEvidence[],
): EmployeePerformanceReviewRecord {
  return {
    reviewId: row.review_id,
    reviewCycleId: row.review_cycle_id,
    employeeId: row.employee_id,
    roleId: row.role_id as EmployeePerformanceReviewRecord["roleId"],
    teamId: row.team_id as EmployeePerformanceReviewRecord["teamId"],
    summary: row.summary,
    strengths: parseJsonArray<string>(row.strengths_json),
    gaps: parseJsonArray<string>(row.gaps_json),
    dimensionScores: parseJsonArray<
      EmployeePerformanceReviewRecord["dimensionScores"][number]
    >(row.dimension_scores_json),
    recommendations: parseJsonArray<EmployeePerformanceRecommendation>(
      row.recommendations_json,
    ),
    evidence,
    createdBy: row.created_by ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

async function listReviewEvidenceMap(
  env: OperatorAgentEnv,
  reviewIds: string[],
): Promise<Record<string, EmployeePerformanceReviewEvidence[]>> {
  if (reviewIds.length === 0) {
    return {};
  }

  const db = requireDb(env);
  const placeholders = reviewIds.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT review_id, evidence_type, evidence_id
       FROM employee_review_evidence_links
       WHERE review_id IN (${placeholders})
       ORDER BY review_id, created_at ASC`,
    )
    .bind(...reviewIds)
    .all<ReviewEvidenceRow>();

  const out: Record<string, EmployeePerformanceReviewEvidence[]> = {};
  for (const row of rows.results ?? []) {
    if (!out[row.review_id]) {
      out[row.review_id] = [];
    }
    out[row.review_id].push({
      evidenceType: row.evidence_type,
      evidenceId: row.evidence_id,
    });
  }

  return out;
}

export async function createReviewCycle(
  env: OperatorAgentEnv,
  input: {
    companyId?: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    status?: "draft" | "active" | "closed";
    createdBy?: string;
  },
): Promise<EmployeeReviewCycleRecord> {
  const db = requireDb(env);
  const reviewCycleId = `review_cycle_${crypto.randomUUID().split("-")[0]}`;

  await db
    .prepare(
      `INSERT INTO employee_review_cycles (
         review_cycle_id,
         company_id,
         name,
         period_start,
         period_end,
         status,
         created_by,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(
      reviewCycleId,
      input.companyId ?? "company_internal_aep",
      input.name,
      input.periodStart,
      input.periodEnd,
      input.status ?? "draft",
      input.createdBy ?? null,
    )
    .run();

  const created = await getReviewCycle(env, reviewCycleId);
  if (!created) {
    throw new Error(`Failed to create review cycle ${reviewCycleId}`);
  }

  return created;
}

export async function listReviewCycles(
  env: OperatorAgentEnv,
): Promise<EmployeeReviewCycleRecord[]> {
  const db = requireDb(env);
  const rows = await db
    .prepare(
      `SELECT
         review_cycle_id,
         company_id,
         name,
         period_start,
         period_end,
         status,
         created_by,
         created_at,
         updated_at
       FROM employee_review_cycles
       ORDER BY period_start DESC, created_at DESC`,
    )
    .all<ReviewCycleRow>();

  return (rows.results ?? []).map(rowToReviewCycle);
}

export async function getReviewCycle(
  env: OperatorAgentEnv,
  reviewCycleId: string,
): Promise<EmployeeReviewCycleRecord | null> {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT
         review_cycle_id,
         company_id,
         name,
         period_start,
         period_end,
         status,
         created_by,
         created_at,
         updated_at
       FROM employee_review_cycles
       WHERE review_cycle_id = ?
       LIMIT 1`,
    )
    .bind(reviewCycleId)
    .first<ReviewCycleRow>();

  return row ? rowToReviewCycle(row) : null;
}

export async function createPerformanceReview(
  env: OperatorAgentEnv,
  input: {
    reviewCycleId: string;
    employeeId: string;
    roleId: string;
    teamId: string;
    summary: string;
    strengths: string[];
    gaps: string[];
    dimensionScores: Array<{ key: string; score: number; note?: string }>;
    recommendations: EmployeePerformanceRecommendation[];
    evidence: EmployeePerformanceReviewEvidence[];
    createdBy?: string;
    approvedBy?: string;
  },
): Promise<EmployeePerformanceReviewRecord> {
  const db = requireDb(env);
  const reviewId = `review_${crypto.randomUUID().split("-")[0]}`;

  await db
    .prepare(
      `INSERT INTO employee_performance_reviews (
         review_id,
         review_cycle_id,
         employee_id,
         role_id,
         team_id,
         summary,
         strengths_json,
         gaps_json,
         dimension_scores_json,
         recommendations_json,
         created_by,
         approved_by,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(
      reviewId,
      input.reviewCycleId,
      input.employeeId,
      input.roleId,
      input.teamId,
      input.summary,
      JSON.stringify(input.strengths),
      JSON.stringify(input.gaps),
      JSON.stringify(input.dimensionScores),
      JSON.stringify(input.recommendations),
      input.createdBy ?? null,
      input.approvedBy ?? null,
    )
    .run();

  for (const evidence of input.evidence) {
    await db
      .prepare(
        `INSERT INTO employee_review_evidence_links (
           review_id,
           evidence_type,
           evidence_id,
           created_at
         ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      )
      .bind(reviewId, evidence.evidenceType, evidence.evidenceId)
      .run();
  }

  const created = await getPerformanceReview(env, reviewId);
  if (!created) {
    throw new Error(`Failed to create performance review ${reviewId}`);
  }

  return created;
}

export async function getPerformanceReview(
  env: OperatorAgentEnv,
  reviewId: string,
): Promise<EmployeePerformanceReviewRecord | null> {
  const db = requireDb(env);
  const row = await db
    .prepare(
      `SELECT
         review_id,
         review_cycle_id,
         employee_id,
         role_id,
         team_id,
         summary,
         strengths_json,
         gaps_json,
         dimension_scores_json,
         recommendations_json,
         created_by,
         approved_by,
         created_at,
         updated_at
       FROM employee_performance_reviews
       WHERE review_id = ?
       LIMIT 1`,
    )
    .bind(reviewId)
    .first<PerformanceReviewRow>();

  if (!row) {
    return null;
  }

  const evidenceMap = await listReviewEvidenceMap(env, [reviewId]);
  return rowToPerformanceReview(row, evidenceMap[reviewId] ?? []);
}

export async function listPerformanceReviewsForEmployee(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeePerformanceReviewRecord[]> {
  const db = requireDb(env);
  const rows = await db
    .prepare(
      `SELECT
         review_id,
         review_cycle_id,
         employee_id,
         role_id,
         team_id,
         summary,
         strengths_json,
         gaps_json,
         dimension_scores_json,
         recommendations_json,
         created_by,
         approved_by,
         created_at,
         updated_at
       FROM employee_performance_reviews
       WHERE employee_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(employeeId)
    .all<PerformanceReviewRow>();

  const reviewIds = (rows.results ?? []).map((row) => row.review_id);
  const evidenceMap = await listReviewEvidenceMap(env, reviewIds);

  return (rows.results ?? []).map((row) =>
    rowToPerformanceReview(row, evidenceMap[row.review_id] ?? []),
  );
}