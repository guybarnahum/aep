import { emitEvent } from "@aep/observability/index";
import type { Env } from "@aep/types/index";
import { newId, nowIso, sha256Hex } from "@aep/shared/index";

type DeployJobType = "deploy_preview" | "teardown_preview";

type AdvanceTimeoutResult =
  | {
      ok: true;
      action: "advance-timeout";
      result: "applied";
      job_id: string;
      run_id: string;
      attempt_id: string;
      message: string;
      retry_scheduled: boolean;
      next_attempt_id?: string;
      next_attempt_no?: number;
      terminal_status?: "failed";
    }
  | {
      ok: false;
      action: "advance-timeout";
      result: "rejected_not_found";
      job_id: string;
      message: string;
      reason: "job_not_found";
    }
  | {
      ok: false;
      action: "advance-timeout";
      result: "rejected_not_eligible";
      job_id: string;
      run_id?: string;
      attempt_id?: string;
      message: string;
      reason:
        | "job_terminal"
        | "attempt_missing"
        | "attempt_not_timeout_eligible";
    };

function getAttemptTimedOutEventType(jobType: DeployJobType): string {
  return jobType === "deploy_preview"
    ? "deploy.attempt_timed_out"
    : "teardown.attempt_timed_out";
}

function getJobRetryScheduledEventType(jobType: DeployJobType): string {
  return jobType === "deploy_preview"
    ? "deploy.job_retry_scheduled"
    : "teardown.job_retry_scheduled";
}

function getJobRetryExhaustedEventType(jobType: DeployJobType): string {
  return jobType === "deploy_preview"
    ? "deploy.job_retry_exhausted"
    : "teardown.job_retry_exhausted";
}

function getAttemptCreatedEventType(jobType: DeployJobType): string {
  return jobType === "deploy_preview"
    ? "deploy.attempt_created"
    : "teardown.attempt_created";
}

function buildAttemptContextPayload(args: {
  jobId: string;
  attemptId?: string;
  attemptNo?: number;
  jobType: DeployJobType;
  provider: string;
  activeAttemptNo?: number | null;
  terminalAttemptNo?: number | null;
  maxAttempts?: number | null;
}): Record<string, unknown> {
  return {
    job_id: args.jobId,
    attempt_id: args.attemptId ?? null,
    attempt_no: args.attemptNo ?? null,
    job_type: args.jobType,
    provider: args.provider,
    active_attempt_no: args.activeAttemptNo ?? null,
    terminal_attempt_no: args.terminalAttemptNo ?? null,
    max_attempts: args.maxAttempts ?? null,
  };
}

function buildFailurePayload(args: {
  failureKind: "attempt_timed_out" | "retry_exhausted";
  errorMessage: string;
  retryable: boolean;
  jobId: string;
  attemptId: string;
  attemptNo: number;
  jobType: DeployJobType;
  provider: string;
  activeAttemptNo?: number | null;
  terminalAttemptNo?: number | null;
  maxAttempts?: number | null;
}): Record<string, unknown> {
  return {
    ...buildAttemptContextPayload({
      jobId: args.jobId,
      attemptId: args.attemptId,
      attemptNo: args.attemptNo,
      jobType: args.jobType,
      provider: args.provider,
      activeAttemptNo: args.activeAttemptNo,
      terminalAttemptNo: args.terminalAttemptNo,
      maxAttempts: args.maxAttempts,
    }),
    error_message: args.errorMessage,
    failure_kind: args.failureKind,
    retryable: args.retryable,
  };
}

function shouldRetryAttempt(args: {
  retryable: boolean;
  currentAttemptNo: number;
  maxAttempts: number;
}): boolean {
  return args.retryable && args.currentAttemptNo < args.maxAttempts;
}

function getNextRetryDelayMs(attemptNo: number): number {
  if (attemptNo <= 1) return 15_000;
  return 60_000;
}

function toIsoFromNow(delayMs: number): string {
  return new Date(Date.now() + delayMs).toISOString();
}

async function assertLogicalJobState(args: {
  env: Env;
  jobId: string;
}): Promise<void> {
  const row = await args.env.DB.prepare(
    `SELECT status, completed_at, terminal_attempt_no, active_attempt_no, next_retry_at
     FROM deploy_jobs
     WHERE id = ?`,
  )
    .bind(args.jobId)
    .first<{
      status: string;
      completed_at: string | null;
      terminal_attempt_no: number | null;
      active_attempt_no: number | null;
      next_retry_at: string | null;
    }>();

  if (!row) {
    throw new Error(`logical job not found after update: ${args.jobId}`);
  }

  if (row.status === "succeeded" || row.status === "failed") {
    if (!row.completed_at) {
      throw new Error(`terminal logical job missing completed_at: ${args.jobId}`);
    }
    if (row.terminal_attempt_no === null) {
      throw new Error(
        `terminal logical job missing terminal_attempt_no: ${args.jobId}`,
      );
    }
  }

  if (row.status === "retry_scheduled") {
    if (row.active_attempt_no === null) {
      throw new Error(`retry_scheduled job missing active_attempt_no: ${args.jobId}`);
    }
    if (!row.next_retry_at) {
      throw new Error(`retry_scheduled job missing next_retry_at: ${args.jobId}`);
    }
  }
}

async function assertWaitingStepConsistency(args: {
  env: Env;
  workflowRunId: string;
  stepName: string;
  expectedStatus: "waiting" | "failed";
}): Promise<void> {
  const row = await args.env.DB.prepare(
    `SELECT status
     FROM workflow_steps
     WHERE workflow_run_id = ? AND step_name = ?
     ORDER BY started_at DESC
     LIMIT 1`,
  )
    .bind(args.workflowRunId, args.stepName)
    .first<{ status: string }>();

  if (!row) {
    throw new Error(
      `workflow step not found: run=${args.workflowRunId} step=${args.stepName}`,
    );
  }

  if (row.status !== args.expectedStatus) {
    throw new Error(
      `workflow step mismatch: run=${args.workflowRunId} step=${args.stepName} expected=${args.expectedStatus} actual=${row.status}`,
    );
  }
}

async function createNextAttemptForJob(args: {
  env: Env;
  traceId: string;
  workflowRunId: string;
  stepName: string;
  jobId: string;
  jobType: DeployJobType;
  provider: string;
  currentAttemptNo: number;
}): Promise<{
  attemptId: string;
  attemptNo: number;
  callbackToken: string;
  createdAt: string;
}> {
  const attemptId = newId("attempt");
  const attemptNo = args.currentAttemptNo + 1;
  const callbackToken = crypto.randomUUID();
  const callbackTokenHash = await sha256Hex(callbackToken);
  const createdAt = nowIso();

  await args.env.DB.prepare(
    `INSERT INTO deploy_job_attempts (
      id,
      job_id,
      attempt_no,
      status,
      callback_token_hash,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      attemptId,
      args.jobId,
      attemptNo,
      "queued",
      callbackTokenHash,
      createdAt,
    )
    .run();

  await emitEvent(args.env.DB, {
    traceId: args.traceId,
    workflowRunId: args.workflowRunId,
    stepName: args.stepName as never,
    eventType: getAttemptCreatedEventType(args.jobType),
    payload: {
      ...buildAttemptContextPayload({
        jobId: args.jobId,
        attemptId,
        attemptNo,
        jobType: args.jobType,
        provider: args.provider,
        activeAttemptNo: attemptNo,
        terminalAttemptNo: null,
      }),
      created_at: createdAt,
    },
  });

  if (args.env.APP_ENV === "dev") {
    await emitEvent(args.env.DB, {
      traceId: args.traceId,
      workflowRunId: args.workflowRunId,
      stepName: args.stepName as never,
      eventType: "deploy_job.debug_token",
      payload: {
        job_id: args.jobId,
        attempt_id: attemptId,
        attempt_no: attemptNo,
        callback_token: callbackToken,
      },
    });
  }

  return { attemptId, attemptNo, callbackToken, createdAt };
}

async function emitOperatorEvent(args: {
  env: Env;
  traceId: string;
  workflowRunId: string;
  stepName: string;
  eventType:
    | "operator.action_requested"
    | "operator.action_applied"
    | "operator.action_rejected";
  payload: Record<string, unknown>;
}): Promise<void> {
  await emitEvent(args.env.DB, {
    traceId: args.traceId,
    workflowRunId: args.workflowRunId,
    stepName: args.stepName as never,
    eventType: args.eventType,
    payload: args.payload,
  });
}

export async function advanceTimeoutForJob(args: {
  env: Env;
  jobId: string;
  requestedBy: string;
}): Promise<AdvanceTimeoutResult> {
  const job = await args.env.DB.prepare(
    `SELECT
        dj.id,
        dj.workflow_run_id,
        dj.step_name,
        dj.job_type,
        dj.provider,
        dj.status,
        dj.max_attempts,
        dj.active_attempt_no,
        wr.trace_id
     FROM deploy_jobs dj
     JOIN workflow_runs wr ON wr.id = dj.workflow_run_id
     WHERE dj.id = ?`,
  )
    .bind(args.jobId)
    .first<{
      id: string;
      workflow_run_id: string;
      step_name: string;
      job_type: DeployJobType;
      provider: string;
      status: string;
      max_attempts: number;
      active_attempt_no: number | null;
      trace_id: string;
    }>();

  if (!job) {
    return {
      ok: false,
      action: "advance-timeout",
      result: "rejected_not_found",
      job_id: args.jobId,
      message: "Job not found.",
      reason: "job_not_found",
    };
  }

  await emitOperatorEvent({
    env: args.env,
    traceId: job.trace_id,
    workflowRunId: job.workflow_run_id,
    stepName: job.step_name,
    eventType: "operator.action_requested",
    payload: {
      action_type: "advance-timeout",
      requested_by: args.requestedBy,
      job_id: job.id,
      run_id: job.workflow_run_id,
      active_attempt_no: job.active_attempt_no,
    },
  });

  if (job.status === "succeeded" || job.status === "failed") {
    await emitOperatorEvent({
      env: args.env,
      traceId: job.trace_id,
      workflowRunId: job.workflow_run_id,
      stepName: job.step_name,
      eventType: "operator.action_rejected",
      payload: {
        action_type: "advance-timeout",
        requested_by: args.requestedBy,
        job_id: job.id,
        run_id: job.workflow_run_id,
        reason: "job_terminal",
      },
    });

    return {
      ok: false,
      action: "advance-timeout",
      result: "rejected_not_eligible",
      job_id: job.id,
      run_id: job.workflow_run_id,
      message: "Job is already terminal.",
      reason: "job_terminal",
    };
  }

  if (job.active_attempt_no === null) {
    await emitOperatorEvent({
      env: args.env,
      traceId: job.trace_id,
      workflowRunId: job.workflow_run_id,
      stepName: job.step_name,
      eventType: "operator.action_rejected",
      payload: {
        action_type: "advance-timeout",
        requested_by: args.requestedBy,
        job_id: job.id,
        run_id: job.workflow_run_id,
        reason: "attempt_missing",
      },
    });

    return {
      ok: false,
      action: "advance-timeout",
      result: "rejected_not_eligible",
      job_id: job.id,
      run_id: job.workflow_run_id,
      message: "Job has no active attempt.",
      reason: "attempt_missing",
    };
  }

  const currentAttempt = await args.env.DB.prepare(
    `SELECT id, attempt_no, status
     FROM deploy_job_attempts
     WHERE job_id = ? AND attempt_no = ?`,
  )
    .bind(job.id, job.active_attempt_no)
    .first<{
      id: string;
      attempt_no: number;
      status: string;
    }>();

  if (!currentAttempt) {
    await emitOperatorEvent({
      env: args.env,
      traceId: job.trace_id,
      workflowRunId: job.workflow_run_id,
      stepName: job.step_name,
      eventType: "operator.action_rejected",
      payload: {
        action_type: "advance-timeout",
        requested_by: args.requestedBy,
        job_id: job.id,
        run_id: job.workflow_run_id,
        reason: "attempt_missing",
      },
    });

    return {
      ok: false,
      action: "advance-timeout",
      result: "rejected_not_eligible",
      job_id: job.id,
      run_id: job.workflow_run_id,
      message: "Active attempt not found.",
      reason: "attempt_missing",
    };
  }

  if (currentAttempt.status !== "queued" && currentAttempt.status !== "running") {
    await emitOperatorEvent({
      env: args.env,
      traceId: job.trace_id,
      workflowRunId: job.workflow_run_id,
      stepName: job.step_name,
      eventType: "operator.action_rejected",
      payload: {
        action_type: "advance-timeout",
        requested_by: args.requestedBy,
        job_id: job.id,
        run_id: job.workflow_run_id,
        attempt_id: currentAttempt.id,
        attempt_no: currentAttempt.attempt_no,
        reason: "attempt_not_timeout_eligible",
      },
    });

    return {
      ok: false,
      action: "advance-timeout",
      result: "rejected_not_eligible",
      job_id: job.id,
      run_id: job.workflow_run_id,
      attempt_id: currentAttempt.id,
      message: "Only queued or running attempts can be advanced by timeout.",
      reason: "attempt_not_timeout_eligible",
    };
  }

  const completedAt = nowIso();
  const errorMessage = "Attempt timed out";

  await args.env.DB.prepare(
    `UPDATE deploy_job_attempts
     SET status = ?, error_message = ?, completed_at = ?, superseded_at = ?
     WHERE id = ?`,
  )
    .bind("failed", errorMessage, completedAt, completedAt, currentAttempt.id)
    .run();

  await emitEvent(args.env.DB, {
    traceId: job.trace_id,
    workflowRunId: job.workflow_run_id,
    stepName: job.step_name as never,
    eventType: getAttemptTimedOutEventType(job.job_type),
    payload: buildFailurePayload({
      failureKind: "attempt_timed_out",
      errorMessage,
      retryable: true,
      jobId: job.id,
      attemptId: currentAttempt.id,
      attemptNo: currentAttempt.attempt_no,
      jobType: job.job_type,
      provider: job.provider,
      activeAttemptNo: job.active_attempt_no,
      terminalAttemptNo: null,
      maxAttempts: job.max_attempts,
    }),
  });

  const maxAttempts = typeof job.max_attempts === "number" ? job.max_attempts : 3;
  const shouldRetry = shouldRetryAttempt({
    retryable: true,
    currentAttemptNo: currentAttempt.attempt_no,
    maxAttempts,
  });

  if (shouldRetry) {
    const nextRetryAt = toIsoFromNow(getNextRetryDelayMs(currentAttempt.attempt_no));
    const nextAttempt = await createNextAttemptForJob({
      env: args.env,
      traceId: job.trace_id,
      workflowRunId: job.workflow_run_id,
      stepName: job.step_name,
      jobId: job.id,
      jobType: job.job_type,
      provider: job.provider,
      currentAttemptNo: currentAttempt.attempt_no,
    });

    await args.env.DB.prepare(
      `UPDATE deploy_jobs
       SET status = ?, attempt_count = ?, active_attempt_no = ?, next_retry_at = ?, error_message = ?, completed_at = NULL
       WHERE id = ?`,
    )
      .bind(
        "retry_scheduled",
        nextAttempt.attemptNo,
        nextAttempt.attemptNo,
        nextRetryAt,
        errorMessage,
        job.id,
      )
      .run();

    await assertLogicalJobState({ env: args.env, jobId: job.id });
    await assertWaitingStepConsistency({
      env: args.env,
      workflowRunId: job.workflow_run_id,
      stepName: job.step_name,
      expectedStatus: "waiting",
    });

    await emitEvent(args.env.DB, {
      traceId: job.trace_id,
      workflowRunId: job.workflow_run_id,
      stepName: job.step_name as never,
      eventType: getJobRetryScheduledEventType(job.job_type),
      payload: {
        ...buildFailurePayload({
          failureKind: "attempt_timed_out",
          errorMessage,
          retryable: true,
          jobId: job.id,
          attemptId: currentAttempt.id,
          attemptNo: currentAttempt.attempt_no,
          jobType: job.job_type,
          provider: job.provider,
          activeAttemptNo: nextAttempt.attemptNo,
          terminalAttemptNo: null,
          maxAttempts,
        }),
        failed_attempt_id: currentAttempt.id,
        failed_attempt_no: currentAttempt.attempt_no,
        next_attempt_id: nextAttempt.attemptId,
        next_attempt_no: nextAttempt.attemptNo,
        retry_at: nextRetryAt,
      },
    });

    await emitOperatorEvent({
      env: args.env,
      traceId: job.trace_id,
      workflowRunId: job.workflow_run_id,
      stepName: job.step_name,
      eventType: "operator.action_applied",
      payload: {
        action_type: "advance-timeout",
        requested_by: args.requestedBy,
        job_id: job.id,
        run_id: job.workflow_run_id,
        attempt_id: currentAttempt.id,
        attempt_no: currentAttempt.attempt_no,
        retry_scheduled: true,
        next_attempt_id: nextAttempt.attemptId,
        next_attempt_no: nextAttempt.attemptNo,
      },
    });

    return {
      ok: true,
      action: "advance-timeout",
      result: "applied",
      job_id: job.id,
      run_id: job.workflow_run_id,
      attempt_id: currentAttempt.id,
      message: "Timeout handling advanced for job.",
      retry_scheduled: true,
      next_attempt_id: nextAttempt.attemptId,
      next_attempt_no: nextAttempt.attemptNo,
    };
  }

  await args.env.DB.prepare(
    `UPDATE deploy_jobs
     SET status = ?, error_message = ?, completed_at = ?, terminal_attempt_no = ?, next_retry_at = NULL
     WHERE id = ?`,
  )
    .bind(
      "failed",
      errorMessage,
      completedAt,
      currentAttempt.attempt_no,
      job.id,
    )
    .run();

  await assertLogicalJobState({ env: args.env, jobId: job.id });

  await emitEvent(args.env.DB, {
    traceId: job.trace_id,
    workflowRunId: job.workflow_run_id,
    stepName: job.step_name as never,
    eventType: getJobRetryExhaustedEventType(job.job_type),
    payload: {
      ...buildFailurePayload({
        failureKind: "retry_exhausted",
        errorMessage,
        retryable: true,
        jobId: job.id,
        attemptId: currentAttempt.id,
        attemptNo: currentAttempt.attempt_no,
        jobType: job.job_type,
        provider: job.provider,
        activeAttemptNo: job.active_attempt_no,
        terminalAttemptNo: currentAttempt.attempt_no,
        maxAttempts,
      }),
      final_attempt_id: currentAttempt.id,
      final_attempt_no: currentAttempt.attempt_no,
      resource_cleanup_may_be_incomplete:
        job.job_type === "teardown_preview" ? true : null,
    },
  });

  await args.env.DB.prepare(
    `UPDATE workflow_steps
     SET status = ?, completed_at = ?, error_message = ?
     WHERE workflow_run_id = ? AND step_name = ? AND status = ?`,
  )
    .bind(
      "failed",
      completedAt,
      errorMessage,
      job.workflow_run_id,
      job.step_name,
      "waiting",
    )
    .run();

  await assertWaitingStepConsistency({
    env: args.env,
    workflowRunId: job.workflow_run_id,
    stepName: job.step_name,
    expectedStatus: "failed",
  });

  const doId = args.env.WORKFLOW_COORDINATOR.idFromName(job.workflow_run_id);
  const stub = args.env.WORKFLOW_COORDINATOR.get(doId);
  await stub.fetch(new Request("https://do/resume", { method: "POST" }));

  await emitOperatorEvent({
    env: args.env,
    traceId: job.trace_id,
    workflowRunId: job.workflow_run_id,
    stepName: job.step_name,
    eventType: "operator.action_applied",
    payload: {
      action_type: "advance-timeout",
      requested_by: args.requestedBy,
      job_id: job.id,
      run_id: job.workflow_run_id,
      attempt_id: currentAttempt.id,
      attempt_no: currentAttempt.attempt_no,
      retry_scheduled: false,
      terminal_status: "failed",
    },
  });

  return {
    ok: true,
    action: "advance-timeout",
    result: "applied",
    job_id: job.id,
    run_id: job.workflow_run_id,
    attempt_id: currentAttempt.id,
    message: "Timeout handling advanced for job.",
    retry_scheduled: false,
    terminal_status: "failed",
  };
}
