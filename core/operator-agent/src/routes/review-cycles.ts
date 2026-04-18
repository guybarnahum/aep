import {
  createReviewCycle,
  listReviewCycles,
} from "@aep/operator-agent/persistence/d1/performance-review-store-d1";
import type { OperatorAgentEnv } from "@aep/operator-agent/types";

type CreateReviewCycleRequest = {
  companyId?: string;
  name?: string;
  periodStart?: string;
  periodEnd?: string;
  status?: "draft" | "active" | "closed";
  createdBy?: string;
};

export async function handleReviewCycles(
  request: Request,
  env?: OperatorAgentEnv,
): Promise<Response> {
  if (!env) {
    return Response.json(
      { ok: false, error: "Missing operator-agent environment" },
      { status: 500 },
    );
  }

  if (request.method === "GET") {
    const reviewCycles = await listReviewCycles(env);
    return Response.json({
      ok: true,
      count: reviewCycles.length,
      reviewCycles,
    });
  }

  if (request.method === "POST") {
    let body: CreateReviewCycleRequest;
    try {
      body = (await request.json()) as CreateReviewCycleRequest;
    } catch {
      return Response.json(
        { ok: false, error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    if (!body.name || !body.periodStart || !body.periodEnd) {
      return Response.json(
        { ok: false, error: "name, periodStart, and periodEnd are required" },
        { status: 400 },
      );
    }

    try {
      const reviewCycle = await createReviewCycle(env, {
        companyId: body.companyId,
        name: body.name,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        status: body.status,
        createdBy: body.createdBy,
      });

      return Response.json(
        {
          ok: true,
          reviewCycle,
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
              : "Failed to create review cycle",
        },
        { status: 400 },
      );
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}