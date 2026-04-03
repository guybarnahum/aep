import {
  json,
  maybeInjectRuntimeReadFailure,
  notFound,
  withRuntimeJsonBoundary,
} from "@aep/control-plane/lib/http";
import {
  getRunDetail,
  getRunJobs,
  getRunSummary,
  listRunSummaries,
} from "@aep/control-plane/operator/runs";

type EnvLike = {
  DB: D1Database;
};

export async function handleRunsRoute(
  request: Request,
  env: EnvLike,
  url: URL,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/runs",
    request,
    handler: async () => {
      maybeInjectRuntimeReadFailure(request, env);

      const limitParam = url.searchParams.get("limit");
      const parsedLimit = limitParam ? Number(limitParam) : Number.NaN;
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(Math.trunc(parsedLimit), 200)
          : 25;

      const runs = await listRunSummaries(env.DB, limit);
      return json({ runs });
    },
  });
}

export async function handleRunSummaryRoute(
  request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/runs/:id/summary",
    request,
    runId,
    resourceId: runId,
    handler: async () => {
      const summary = await getRunSummary(env.DB, runId);
      if (!summary) {
        return notFound(`run not found: ${runId}`);
      }

      return json(summary);
    },
  });
}

export async function handleRunDetailRoute(
  request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/runs/:id",
    request,
    runId,
    resourceId: runId,
    handler: async () => {
      const detail = await getRunDetail(env.DB, runId);
      if (!detail) {
        return notFound(`run not found: ${runId}`);
      }

      return json(detail);
    },
  });
}

export async function handleRunJobsRoute(
  request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/runs/:id/jobs",
    request,
    runId,
    resourceId: runId,
    handler: async () => {
      const jobs = await getRunJobs(env.DB, runId);
      if (!jobs) {
        return notFound(`run not found: ${runId}`);
      }

      return json({ run_id: runId, jobs });
    },
  });
}

export async function handleRunFailureRoute(
  request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  return withRuntimeJsonBoundary({
    route: "/runs/:id/failure",
    request,
    runId,
    resourceId: runId,
    handler: async () => {
      const detail = await getRunDetail(env.DB, runId);
      if (!detail) {
        return notFound(`run not found: ${runId}`);
      }

      return json({ run_id: runId, failure: detail.failure });
    },
  });
}