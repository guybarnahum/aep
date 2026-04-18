import {
  createPerformanceReview,
  getReviewCycle,
  listPerformanceReviewsForEmployee,
} from "@aep/operator-agent/persistence/d1/performance-review-store-d1";
import { getRoleCatalogEntry } from "@aep/operator-agent/persistence/d1/role-catalog-store-d1";
import type {
  EmployeePerformanceRecommendation,
  EmployeePerformanceReviewEvidence,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

type EmployeeCatalogIdentityRow = {
  team_id: string;
  role_id: string;
  employment_status: string;
};

type CreateEmployeeReviewRequest = {
  reviewCycleId?: string;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  dimensionScores?: Array<{ key: string; score: number; note?: string }>;
  recommendations?: EmployeePerformanceRecommendation[];
  evidence?: EmployeePerformanceReviewEvidence[];
  createdBy?: string;
  approvedBy?: string;
};

async function getEmployeeIdentity(
  env: OperatorAgentEnv,
  employeeId: string,
): Promise<EmployeeCatalogIdentityRow | null> {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  return (
    (await env.OPERATOR_AGENT_DB.prepare(
      `SELECT team_id, role_id, employment_status
       FROM employees_catalog
       WHERE id = ?
       LIMIT 1`,
    )
      .bind(employeeId)
      .first<EmployeeCatalogIdentityRow>()) ?? null
  );
}

async function assertEvidenceExists(
  env: OperatorAgentEnv,
  evidence: EmployeePerformanceReviewEvidence,
): Promise<void> {
  if (!env.OPERATOR_AGENT_DB) {
    throw new Error("Missing OPERATOR_AGENT_DB binding");
  }

  let row: { id?: string } | { thread_id?: string } | null = null;

  switch (evidence.evidenceType) {
    case "task":
      row = await env.OPERATOR_AGENT_DB.prepare(
        `SELECT id
         FROM tasks
         WHERE id = ?
         LIMIT 1`,
      )
        .bind(evidence.evidenceId)
        .first<{ id: string }>();
      break;
    case "artifact":
      row = await env.OPERATOR_AGENT_DB.prepare(
        `SELECT id
         FROM task_artifacts
         WHERE id = ?
         LIMIT 1`,
      )
        .bind(evidence.evidenceId)
        .first<{ id: string }>();
      break;
    case "thread":
      row = await env.OPERATOR_AGENT_DB.prepare(
        `SELECT thread_id
         FROM message_threads
         WHERE thread_id = ?
         LIMIT 1`,
      )
        .bind(evidence.evidenceId)
        .first<{ thread_id: string }>();
      break;
  }

  if (!row) {
    throw new Error(
      `Evidence not found for ${evidence.evidenceType}:${evidence.evidenceId}`,
    );
  }
}

function assertReviewRecommendationPolicy(
  recommendations: EmployeePerformanceRecommendation[],
  approvedBy?: string,
): void {
  const hasHighImpactRecommendation = recommendations.some((recommendation) =>
    ["promote", "reassign", "restrict"].includes(
      recommendation.recommendationType,
    ),
  );

  if (
    hasHighImpactRecommendation &&
    (!approvedBy || approvedBy.trim().length === 0)
  ) {
    throw new Error(
      "approvedBy is required for promote, reassign, or restrict recommendations",
    );
  }
}

export async function handleEmployeeReviews(
  request: Request,
  env: OperatorAgentEnv | undefined,
  employeeId: string,
): Promise<Response> {
  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  if (request.method === "GET") {
    const reviews = await listPerformanceReviewsForEmployee(env, employeeId);
    return Response.json({
      ok: true,
      employeeId,
      count: reviews.length,
      reviews,
    });
  }

  if (request.method === "POST") {
    let body: CreateEmployeeReviewRequest;
    try {
      body = (await request.json()) as CreateEmployeeReviewRequest;
    } catch {
      return Response.json(
        { ok: false, error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    if (
      !body.reviewCycleId ||
      !body.summary ||
      !Array.isArray(body.dimensionScores) ||
      !Array.isArray(body.recommendations) ||
      !Array.isArray(body.evidence)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "reviewCycleId, summary, dimensionScores, recommendations, and evidence are required",
        },
        { status: 400 },
      );
    }

    try {
      const employee = await getEmployeeIdentity(env, employeeId);
      if (!employee) {
        throw new Error(`Employee not found: ${employeeId}`);
      }

      if (
        !["active", "on_leave", "retired", "terminated"].includes(
          employee.employment_status,
        )
      ) {
        throw new Error(
          `Cannot create performance review for employmentStatus=${employee.employment_status}`,
        );
      }

      const reviewCycle = await getReviewCycle(env, body.reviewCycleId);
      if (!reviewCycle) {
        throw new Error(`Review cycle not found: ${body.reviewCycleId}`);
      }

      if (reviewCycle.status !== "active") {
        throw new Error(
          `Reviews may only be created in active review cycles; got status=${reviewCycle.status}`,
        );
      }

      const role = await getRoleCatalogEntry(env, employee.role_id);
      if (!role) {
        throw new Error(`Role not found: ${employee.role_id}`);
      }

      const allowedDimensionKeys = new Set(
        (role.reviewDimensions ?? []).map((dimension) => dimension.key),
      );

      for (const dimensionScore of body.dimensionScores) {
        if (!allowedDimensionKeys.has(dimensionScore.key)) {
          throw new Error(
            `Unknown review dimension ${dimensionScore.key} for role ${role.roleId}`,
          );
        }
      }

      if (body.dimensionScores.length === 0) {
        throw new Error("At least one dimension score is required");
      }

      for (const dimensionScore of body.dimensionScores) {
        if (
          !Number.isFinite(dimensionScore.score) ||
          dimensionScore.score < 1 ||
          dimensionScore.score > 5
        ) {
          throw new Error(
            `Invalid review score ${dimensionScore.score} for dimension ${dimensionScore.key}; expected 1-5`,
          );
        }
      }

      if (body.recommendations.length === 0) {
        throw new Error("At least one review recommendation is required");
      }

      if (body.evidence.length === 0) {
        throw new Error("At least one evidence link is required");
      }

      assertReviewRecommendationPolicy(body.recommendations, body.approvedBy);

      for (const evidence of body.evidence) {
        await assertEvidenceExists(env, evidence);
      }

      const review = await createPerformanceReview(env, {
        reviewCycleId: body.reviewCycleId,
        employeeId,
        roleId: employee.role_id,
        teamId: employee.team_id,
        summary: body.summary,
        strengths: body.strengths ?? [],
        gaps: body.gaps ?? [],
        dimensionScores: body.dimensionScores,
        recommendations: body.recommendations,
        evidence: body.evidence,
        createdBy: body.createdBy,
        approvedBy: body.approvedBy,
      });

      return Response.json(
        {
          ok: true,
          employeeId,
          review,
        },
        { status: 201 },
      );
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create employee review",
        },
        { status: 400 },
      );
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}