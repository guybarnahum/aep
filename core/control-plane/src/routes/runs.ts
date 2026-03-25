import { json, notFound } from "@aep/control-plane/lib/http";
import {
  getRunDetail,
  getRunFailure,
  getRunJobs,
  getRunSummary,
  listRunSummaries,
} from "@aep/control-plane/operator/runs";

type EnvLike = {
  DB: D1Database;
};

export async function handleRunsRoute(
  _request: Request,
  env: EnvLike,
  url: URL,
): Promise<Response> {
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && Number.isFinite(Number(limitParam))
      ? Number(limitParam)
      : 25;

  const runs = await listRunSummaries(env.DB, limit);
  return json({ runs });
}

export async function handleRunSummaryRoute(
  _request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  const summary = await getRunSummary(env.DB, runId);
  if (!summary) {
    return notFound(`run not found: ${runId}`);
  }

  return json(summary);
}

export async function handleRunDetailRoute(
  _request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  const detail = await getRunDetail(env.DB, runId);
  if (!detail) {
    return notFound(`run not found: ${runId}`);
  }

  return json(detail);
}

export async function handleRunJobsRoute(
  _request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  const jobs = await getRunJobs(env.DB, runId);
  if (!jobs) {
    return notFound(`run not found: ${runId}`);
  }

  return json({ run_id: runId, jobs });
}

export async function handleRunFailureRoute(
  _request: Request,
  env: EnvLike,
  runId: string,
): Promise<Response> {
  const detail = await getRunDetail(env.DB, runId);
  if (!detail) {
    return notFound(`run not found: ${runId}`);
  }

  return json({ run_id: runId, failure: detail.failure });
}