import { buildTracePath } from "../lib/urls";
import {
  deriveActiveAttempt,
  deriveEnvironmentName,
  deriveJobStatus,
  deriveLatestFailureKind,
  deriveRunStatus,
  deriveUpdatedAt,
} from "./derive";
import {
  fetchAttemptsForJob,
  fetchRecentRuns,
  fetchRunById,
  fetchRunJobs,
  fetchRunSteps,
} from "./queries";
import type {
  RunAttemptView,
  RunDetail,
  RunFailureView,
  RunJobView,
  RunSummary,
} from "./types";

type D1Like = D1Database;

function coerceServiceName(serviceName: string | null, repoUrl: string | null): string {
  if (serviceName && serviceName.trim()) return serviceName.trim();

  if (repoUrl) {
    const parts = repoUrl.split("/");
    const last = parts.at(-1);
    if (last) {
      return last.replace(/\.git$/, "");
    }
  }

  return "unmapped";
}

export async function listRunSummaries(
  db: D1Like,
  limit = 25,
): Promise<RunSummary[]> {
  const runs = await fetchRecentRuns(db, limit);

  const summaries = await Promise.all(
    runs.map(async (run) => {
      const steps = await fetchRunSteps(db, run.run_id);
      const jobs = await fetchRunJobs(db, run.run_id);

      const attemptsByJob = await Promise.all(
        jobs.map(async (job) => ({
          job,
          attempts: await fetchAttemptsForJob(db, job.job_id),
        })),
      );

      const latestJob =
        jobs[jobs.length - 1] ??
        null;

      const latestAttempts =
        attemptsByJob[attemptsByJob.length - 1]?.attempts ?? [];

      return {
        run_id: run.run_id,
        tenant_id: run.tenant_id,
        project_id: run.project_id,
        service_name: coerceServiceName(run.service_name, run.repo_url),
        environment_name: deriveEnvironmentName(run.branch),
        repo_url: run.repo_url,
        branch: run.branch,
        provider: latestJob?.provider ?? null,
        status: deriveRunStatus({
          run: {
            status: run.workflow_status,
            completed_at: run.completed_at,
          },
          jobs,
          attempts: attemptsByJob.flatMap((entry) => entry.attempts),
        }),
        current_step:
          latestJob?.step_name ??
          steps[steps.length - 1]?.step_name ??
          null,
        logical_job_type: latestJob?.job_type ?? null,
        logical_job_status: deriveJobStatus({
          jobStatus: latestJob?.status ?? null,
          attempts: latestAttempts,
        }),
        active_attempt:
          latestJob?.active_attempt_no ??
          deriveActiveAttempt(latestAttempts),
        latest_failure_kind: deriveLatestFailureKind(
          attemptsByJob.flatMap((entry) => entry.attempts),
          jobs,
          run.workflow_status,
        ),
        created_at: run.created_at,
        updated_at: deriveUpdatedAt([
          run.completed_at,
          ...steps.flatMap((step) => [step.started_at, step.completed_at]),
          ...jobs.flatMap((job) => [
            job.created_at,
            job.started_at,
            job.completed_at,
            job.last_dispatched_at,
            job.next_retry_at,
          ]),
          ...attemptsByJob.flatMap((entry) =>
            entry.attempts.flatMap((attempt) => [
              attempt.created_at,
              attempt.started_at,
              attempt.completed_at,
              attempt.superseded_at,
            ]),
          ),
        ]),
        completed_at: run.completed_at,
        trace_id: run.trace_id,
        trace_path: buildTracePath(run.trace_id),
      } satisfies RunSummary;
    }),
  );

  return summaries;
}

export async function getRunDetail(
  db: D1Like,
  runId: string,
): Promise<RunDetail | null> {
  const run = await fetchRunById(db, runId);
  if (!run) return null;

  const steps = await fetchRunSteps(db, runId);
  const jobs = await fetchRunJobs(db, runId);

  const jobViews: RunJobView[] = [];
  let latestFailure: RunFailureView | null = null;
  const allAttempts = [];

  for (const job of jobs) {
    const attempts = await fetchAttemptsForJob(db, job.job_id);
    allAttempts.push(...attempts);

    const attemptViews: RunAttemptView[] = attempts.map((attempt) => ({
      job_id: attempt.job_id,
      attempt: attempt.attempt_no,
      status: attempt.status,
      started_at: attempt.started_at,
      completed_at: attempt.completed_at,
      superseded_at: attempt.superseded_at,
      error_message: attempt.error_message,
      result_json: attempt.result_json
        ? safeParseJson(attempt.result_json)
        : null,
    }));

    const failedAttempt = [...attempts]
      .filter((attempt) => attempt.status === "failed")
      .sort((a, b) => b.attempt_no - a.attempt_no)[0];

    if (failedAttempt && !latestFailure) {
      latestFailure = {
        run_id: runId,
        step: job.step_name,
        logical_job_type: job.job_type,
        attempt: failedAttempt.attempt_no,
        failure_kind: "attempt_failed",
        failure_message: failedAttempt.error_message,
        failure_payload: failedAttempt.result_json
          ? safeParseJson(failedAttempt.result_json)
          : null,
      };
    }

    if (!latestFailure && job.status === "failed") {
      latestFailure = {
        run_id: runId,
        step: job.step_name,
        logical_job_type: job.job_type,
        attempt: job.terminal_attempt_no ?? null,
        failure_kind: "job_failed",
        failure_message: job.error_message,
        failure_payload: job.result_json ? safeParseJson(job.result_json) : null,
      };
    }

    jobViews.push({
      job_id: job.job_id,
      step_name: job.step_name,
      job_type: job.job_type,
      provider: job.provider,
      status: deriveJobStatus({
        jobStatus: job.status,
        attempts,
      }),
      active_attempt: job.active_attempt_no ?? deriveActiveAttempt(attempts),
      max_attempts: job.max_attempts,
      attempt_count: job.attempt_count,
      terminal_attempt_no: job.terminal_attempt_no,
      next_retry_at: job.next_retry_at,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      error_message: job.error_message,
      result_json: job.result_json ? safeParseJson(job.result_json) : null,
      attempts: attemptViews,
    });
  }

  if (!latestFailure && run.workflow_status === "failed") {
    const failedStep = [...steps]
      .filter((step) => step.status === "failed")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];

    latestFailure = {
      run_id: runId,
      step: failedStep?.step_name ?? null,
      logical_job_type: null,
      attempt: null,
      failure_kind: "workflow_failed",
      failure_message: failedStep?.error_message ?? null,
      failure_payload: null,
    };
  }

  const latestJob = jobViews[jobViews.length - 1] ?? null;

  return {
    run_id: run.run_id,
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    service_name: coerceServiceName(run.service_name, run.repo_url),
    environment_name: deriveEnvironmentName(run.branch),
    repo_url: run.repo_url,
    branch: run.branch,
    provider: latestJob?.provider ?? null,
    status: deriveRunStatus({
      run: {
        status: run.workflow_status,
        completed_at: run.completed_at,
      },
      jobs,
      attempts: allAttempts,
    }),
    current_step:
      latestJob?.step_name ??
      steps[steps.length - 1]?.step_name ??
      null,
    logical_job_type: latestJob?.job_type ?? null,
    logical_job_status: latestJob?.status ?? null,
    active_attempt: latestJob?.active_attempt ?? null,
    latest_failure_kind: latestFailure?.failure_kind ?? null,
    created_at: run.created_at,
    updated_at: deriveUpdatedAt([
      run.completed_at,
      ...steps.flatMap((step) => [step.started_at, step.completed_at]),
      ...jobs.flatMap((job) => [
        job.created_at,
        job.started_at,
        job.completed_at,
        job.last_dispatched_at,
        job.next_retry_at,
      ]),
      ...allAttempts.flatMap((attempt) => [
        attempt.created_at,
        attempt.started_at,
        attempt.completed_at,
        attempt.superseded_at,
      ]),
    ]),
    completed_at: run.completed_at,
    trace_id: run.trace_id,
    trace_path: buildTracePath(run.trace_id),
    steps: steps.map((step) => ({
      step: step.step_name,
      status: step.status,
      started_at: step.started_at,
      completed_at: step.completed_at,
      error_message: step.error_message,
    })),
    jobs: jobViews,
    failure: latestFailure,
  };
}

export async function getRunSummary(
  db: D1Like,
  runId: string,
): Promise<RunSummary | null> {
  const detail = await getRunDetail(db, runId);
  if (!detail) return null;

  const {
    steps: _steps,
    jobs: _jobs,
    failure: _failure,
    ...summary
  } = detail;

  return summary;
}

export async function getRunJobs(
  db: D1Like,
  runId: string,
): Promise<RunJobView[] | null> {
  const detail = await getRunDetail(db, runId);
  return detail?.jobs ?? null;
}

export async function getRunFailure(
  db: D1Like,
  runId: string,
): Promise<RunFailureView | null> {
  const detail = await getRunDetail(db, runId);
  return detail?.failure ?? null;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}