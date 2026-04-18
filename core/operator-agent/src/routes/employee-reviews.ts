import {
  createPerformanceReview,
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
      `SELECT team_id, role_id
       FROM employees_catalog
       WHERE id = ?
       LIMIT 1`,
    )
      .bind(employeeId)
      .first<EmployeeCatalogIdentityRow>()) ?? null
  );
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