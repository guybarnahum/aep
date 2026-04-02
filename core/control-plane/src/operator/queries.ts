export type RawRunRow = {
  run_id: string;
  tenant_id: string;
  project_id: string;
  service_name: string | null;
  repo_url: string;
  branch: string;
  workflow_status: string;
  trace_id: string;
  created_at: string;
  completed_at: string | null;
};

export type RawStepRow = {
  workflow_run_id: string;
  step_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
};

export type RawJobRow = {
  job_id: string;
  workflow_run_id: string;
  step_name: string;
  job_type: string;
  provider: string;
  status: string;
  request_json: string;
  result_json: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  max_attempts: number | null;
  attempt_count: number | null;
  active_attempt_no: number | null;
  terminal_attempt_no: number | null;
  last_dispatched_at: string | null;
  next_retry_at: string | null;
};

export type RawAttemptRow = {
  job_id: string;
  attempt_no: number;
  status: string;
  result_json: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  superseded_at: string | null;
};

type D1Like = D1Database;

export async function fetchRecentRuns(
  db: D1Like,
  limit: number,
): Promise<RawRunRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        id AS run_id,
        tenant_id,
        project_id,
        service_name,
        repo_url,
        branch,
        status AS workflow_status,
        trace_id,
        created_at,
        completed_at
      FROM workflow_runs
      ORDER BY created_at DESC
      LIMIT ?
      `,
    )
    .bind(limit)
    .all<RawRunRow>();

  return result.results ?? [];
}

export async function fetchRunById(
  db: D1Like,
  runId: string,
): Promise<RawRunRow | null> {
  const row = await db
    .prepare(
      `
      SELECT
        id AS run_id,
        tenant_id,
        project_id,
        service_name,
        repo_url,
        branch,
        status AS workflow_status,
        trace_id,
        created_at,
        completed_at
      FROM workflow_runs
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(runId)
    .first<RawRunRow>();

  return row ?? null;
}

export async function fetchRunSteps(
  db: D1Like,
  runId: string,
): Promise<RawStepRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        workflow_run_id,
        step_name,
        status,
        started_at,
        completed_at,
        error_message
      FROM workflow_steps
      WHERE workflow_run_id = ?
      ORDER BY started_at ASC
      `,
    )
    .bind(runId)
    .all<RawStepRow>();

  return result.results ?? [];
}

export async function fetchRunJobs(
  db: D1Like,
  runId: string,
): Promise<RawJobRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        id AS job_id,
        workflow_run_id,
        step_name,
        job_type,
        provider,
        status,
        request_json,
        result_json,
        error_message,
        created_at,
        started_at,
        completed_at,
        max_attempts,
        attempt_count,
        active_attempt_no,
        terminal_attempt_no,
        last_dispatched_at,
        next_retry_at
      FROM deploy_jobs
      WHERE workflow_run_id = ?
      ORDER BY created_at ASC
      `,
    )
    .bind(runId)
    .all<RawJobRow>();

  return result.results ?? [];
}

export async function fetchAttemptsForJob(
  db: D1Like,
  jobId: string,
): Promise<RawAttemptRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        job_id,
        attempt_no,
        status,
        result_json,
        error_message,
        created_at,
        started_at,
        completed_at,
        superseded_at
      FROM deploy_job_attempts
      WHERE job_id = ?
      ORDER BY attempt_no ASC
      `,
    )
    .bind(jobId)
    .all<RawAttemptRow>();

  return result.results ?? [];
}