#!/usr/bin/env node

/**
 * scripts/ci/commit7-operator-action-check.ts
 *
 * Validates Commit 7 operator advance-timeout behavior:
 * - starts a workflow with deploy_mode=async
 * - polls until DEPLOY enters waiting
 * - fetches run jobs and finds a timeout-eligible job
 * - calls POST /operator/jobs/:jobId/advance-timeout
 * - verifies response shape
 * - verifies job projection changes
 * - verifies trace contains operator action events
 *
 * Example:
 *
 *   npx tsx scripts/ci/commit7-operator-action-check.ts \
 *     --base-url http://127.0.0.1:8787 \
 *     --env dev \
 *     --provider cloudflare \
 *     --service-name sample-worker \
 *     --payload '{"tenant_id":"t_demo","project_id":"p_demo","repo_url":"https://github.com/example/repo","branch":"main","service_name":"sample-worker","deploy_mode":"async","teardown_mode":"async"}' \
 *     --poll-attempts 20 \
 *     --poll-interval-ms 3000
 */

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

type CliOptions = {
  baseUrl: string;
  env?: string;
  provider: string;
  serviceName: string;
  payload: string;
  timeoutMs: number;
  pollAttempts: number;
  pollIntervalMs: number;
};

type RequestResult = {
  status: number;
  statusText: string;
  headers: Headers;
  bodyText: string;
  bodyJson?: unknown;
  durationMs: number;
};

type WorkflowStartResponse = {
  workflow_run_id: string;
  trace_id: string;
  status: string;
};

type WorkflowStep = {
  step_name?: string;
  status?: string;
};

type WorkflowStatusResponse = {
  run?: {
    id?: string;
    status?: string;
  };
  steps?: WorkflowStep[];
};

type TraceEvent = {
  event_type?: string;
  payload?: Record<string, unknown>;
  payload_json?: string;
};

type TraceResponse = {
  trace_id?: string;
  events?: TraceEvent[];
};

type OperatorActionProjection = {
  can_advance_timeout?: boolean;
  advance_timeout_reason?: string | null;
};

type RunAttemptView = {
  attempt?: number;
  status?: string;
  started_at?: string | null;
  completed_at?: string | null;
  superseded_at?: string | null;
  error_message?: string | null;
};

type RunJobView = {
  job_id?: string;
  step_name?: string;
  job_type?: string;
  provider?: string;
  status?: string | null;
  active_attempt?: number | null;
  attempts?: RunAttemptView[];
  operator_actions?: OperatorActionProjection;
};

type RunJobsResponse = {
  run_id?: string;
  jobs?: RunJobView[];
};

type AdvanceTimeoutResponse = {
  ok?: boolean;
  action?: string;
  result?: string;
  job_id?: string;
  run_id?: string;
  attempt_id?: string;
  message?: string;
  reason?: string;
  retry_scheduled?: boolean;
  next_attempt_id?: string;
  next_attempt_no?: number;
  terminal_status?: string;
};

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name}: ${value}`);
  }
  return parsed;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildDefaultPayload(serviceName: string): string {
  return JSON.stringify({
    tenant_id: "t_demo",
    project_id: "p_demo",
    repo_url: "https://github.com/example/repo",
    branch: "main",
    service_name: serviceName,
    deploy_mode: "async",
    teardown_mode: "async",
  });
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }

    args.set(key, next);
    i += 1;
  }

  const baseUrl = args.get("base-url");
  if (!baseUrl) {
    throw new Error(
      [
        "Missing required argument: --base-url",
        "Example:",
        "  npx tsx scripts/ci/commit7-operator-action-check.ts --base-url http://127.0.0.1:8787 --env dev",
      ].join("\n"),
    );
  }

  const serviceName = args.get("service-name") ?? "sample-worker";

  return {
    baseUrl,
    env: args.get("env"),
    provider: args.get("provider") ?? "cloudflare",
    serviceName,
    payload: args.get("payload") ?? buildDefaultPayload(serviceName),
    timeoutMs: parsePositiveInt(args.get("timeout-ms") ?? "15000", "timeout-ms"),
    pollAttempts: parsePositiveInt(args.get("poll-attempts") ?? "20", "poll-attempts"),
    pollIntervalMs: parsePositiveInt(
      args.get("poll-interval-ms") ?? "3000",
      "poll-interval-ms",
    ),
  };
}

async function requestJson(options: {
  url: string;
  method: string;
  timeoutMs: number;
  headers?: Record<string, string>;
  body?: string;
}): Promise<RequestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    const bodyText = await response.text();
    const bodyJson = safeJsonParse(bodyText);

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      bodyText,
      bodyJson,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildHeaders(env?: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    "user-agent": "aep-ci-commit7-operator-check/1.0",
    "cache-control": "no-cache",
    "x-smoke-test": "true",
  };

  if (env) {
    headers["x-aep-env"] = env;
  }

  return headers;
}

function asWorkflowStartResponse(value: unknown): WorkflowStartResponse {
  if (!isObject(value)) {
    fail("Start response was not a valid JSON object.");
  }

  const workflowRunId = value["workflow_run_id"];
  const traceId = value["trace_id"];
  const status = value["status"];

  if (
    typeof workflowRunId !== "string" ||
    typeof traceId !== "string" ||
    typeof status !== "string"
  ) {
    fail(
      `Start response missing required keys.\nBody:\n${JSON.stringify(value, null, 2)}`,
    );
  }

  return {
    workflow_run_id: workflowRunId,
    trace_id: traceId,
    status,
  };
}

function asWorkflowStatusResponse(value: unknown): WorkflowStatusResponse {
  if (!isObject(value)) {
    fail("Workflow status response was not a JSON object.");
  }
  return value as WorkflowStatusResponse;
}

function asTraceResponse(value: unknown): TraceResponse {
  if (!isObject(value)) {
    fail("Trace response was not a JSON object.");
  }
  return value as TraceResponse;
}

function asRunJobsResponse(value: unknown): RunJobsResponse {
  if (!isObject(value)) {
    fail("Run jobs response was not a JSON object.");
  }
  return value as RunJobsResponse;
}

function asAdvanceTimeoutResponse(value: unknown): AdvanceTimeoutResponse {
  if (!isObject(value)) {
    fail("Advance-timeout response was not a JSON object.");
  }
  return value as AdvanceTimeoutResponse;
}

function getTraceEventPayload(event: TraceEvent): Record<string, unknown> {
  if (isObject(event.payload)) {
    return event.payload;
  }

  if (typeof event.payload_json === "string" && event.payload_json.trim() !== "") {
    const parsed = safeJsonParse(event.payload_json);
    if (isObject(parsed)) {
      return parsed;
    }
  }

  return {};
}

function getStepStatus(
  workflow: WorkflowStatusResponse,
  stepName: string,
): string | undefined {
  const steps = workflow.steps ?? [];
  const step = steps.find((s) => s.step_name === stepName);
  return step?.status;
}

function getRunStatus(workflow: WorkflowStatusResponse): string | undefined {
  return workflow.run?.status;
}

function findTimeoutEligibleJob(jobs: RunJobView[]): RunJobView | undefined {
  return jobs.find(
    (job) => job.operator_actions?.can_advance_timeout === true && typeof job.job_id === "string",
  );
}

function requireTraceEvents(trace: TraceResponse, required: string[]): void {
  const seen = new Set(
    (trace.events ?? []).map((e) => e.event_type).filter(Boolean) as string[],
  );
  const missing = required.filter((name) => !seen.has(name));

  if (missing.length > 0) {
    fail(`Missing expected trace events: ${missing.join(", ")}`);
  }
}

async function waitForDeployWaiting(args: {
  workflowUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
  pollAttempts: number;
  pollIntervalMs: number;
}): Promise<WorkflowStatusResponse> {
  for (let attempt = 1; attempt <= args.pollAttempts; attempt += 1) {
    const result = await requestJson({
      url: args.workflowUrl,
      method: "GET",
      timeoutMs: args.timeoutMs,
      headers: args.headers,
    });

    if (result.status >= 200 && result.status < 300) {
      const workflow = asWorkflowStatusResponse(result.bodyJson);
      const runStatus = stringifyValue(getRunStatus(workflow));
      const deployStatus = stringifyValue(getStepStatus(workflow, "DEPLOY"));

      console.log(
        `   Attempt ${attempt}/${args.pollAttempts}: run.status=${runStatus}, DEPLOY=${deployStatus}, time=${result.durationMs}ms`,
      );

      if (runStatus === "failed" || runStatus === "cancelled") {
        fail(
          `Workflow ended early with status '${runStatus}'.\nResponse:\n${JSON.stringify(workflow, null, 2)}`,
        );
      }

      if (deployStatus === "waiting") {
        return workflow;
      }
    }

    if (attempt < args.pollAttempts) {
      await sleep(args.pollIntervalMs);
    }
  }

  fail("DEPLOY never reached waiting state.");
}

async function waitForEligibleJob(args: {
  runJobsUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
  pollAttempts: number;
  pollIntervalMs: number;
}): Promise<RunJobView> {
  for (let attempt = 1; attempt <= args.pollAttempts; attempt += 1) {
    const result = await requestJson({
      url: args.runJobsUrl,
      method: "GET",
      timeoutMs: args.timeoutMs,
      headers: args.headers,
    });

    if (result.status >= 200 && result.status < 300) {
      const payload = asRunJobsResponse(result.bodyJson);
      const jobs = payload.jobs ?? [];
      const eligible = findTimeoutEligibleJob(jobs);

      console.log(
        `   Attempt ${attempt}/${args.pollAttempts}: jobs=${jobs.length}, eligible=${eligible?.job_id ?? "(none)"}`,
      );

      if (eligible) {
        return eligible;
      }
    }

    if (attempt < args.pollAttempts) {
      await sleep(args.pollIntervalMs);
    }
  }

  fail("Did not observe a timeout-eligible job projection.");
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const cli = parseArgs(process.argv.slice(2));
  const headers = buildHeaders(cli.env);

  console.log("🔁 AEP Commit 7 operator action check");
  console.log(`   Env:           ${cli.env ?? "(not enforced)"}`);
  console.log(`   Base URL:      ${cli.baseUrl}`);
  console.log(`   Provider:      ${cli.provider}`);
  console.log(`   Service name:  ${cli.serviceName}`);
  console.log(`   Timeout:       ${cli.timeoutMs}ms`);
  console.log(`   Poll attempts: ${cli.pollAttempts}`);
  console.log(`   Poll interval: ${cli.pollIntervalMs}ms`);

  const startUrl = joinUrl(cli.baseUrl, "/workflow/start");
  console.log("==> Starting async workflow");

  const startResult = await requestJson({
    url: startUrl,
    method: "POST",
    timeoutMs: cli.timeoutMs,
    headers,
    body: cli.payload,
  });

  console.log(
    `   Response: HTTP ${startResult.status} ${startResult.statusText} (${startResult.durationMs}ms)`,
  );

  if (startResult.status !== 202) {
    fail(
      `Expected HTTP 202 from /workflow/start, got ${startResult.status} ${startResult.statusText}.\nBody:\n${startResult.bodyText}`,
    );
  }

  const start = asWorkflowStartResponse(startResult.bodyJson);
  console.log(`   Workflow run: ${start.workflow_run_id}`);
  console.log(`   Trace id:     ${start.trace_id}`);

  const workflowUrl = joinUrl(
    cli.baseUrl,
    `/workflow/${encodeURIComponent(start.workflow_run_id)}`,
  );
  const runJobsUrl = joinUrl(
    cli.baseUrl,
    `/runs/${encodeURIComponent(start.workflow_run_id)}/jobs`,
  );
  const traceUrl = joinUrl(
    cli.baseUrl,
    `/trace/${encodeURIComponent(start.trace_id)}`,
  );

  console.log("==> Polling until DEPLOY enters waiting");
  await waitForDeployWaiting({
    workflowUrl,
    headers,
    timeoutMs: cli.timeoutMs,
    pollAttempts: cli.pollAttempts,
    pollIntervalMs: cli.pollIntervalMs,
  });

  console.log("✅ DEPLOY entered waiting");

  console.log("==> Polling until a timeout-eligible operator action appears");
  const eligibleJob = await waitForEligibleJob({
    runJobsUrl,
    headers,
    timeoutMs: cli.timeoutMs,
    pollAttempts: cli.pollAttempts,
    pollIntervalMs: cli.pollIntervalMs,
  });

  if (!eligibleJob.job_id) {
    fail("Eligible job missing job_id.");
  }

  console.log(`✅ Found eligible job: ${eligibleJob.job_id}`);

  console.log("==> Calling operator advance-timeout endpoint");
  const operatorUrl = joinUrl(
    cli.baseUrl,
    `/operator/jobs/${encodeURIComponent(eligibleJob.job_id)}/advance-timeout`,
  );

  const operatorResult = await requestJson({
    url: operatorUrl,
    method: "POST",
    timeoutMs: cli.timeoutMs,
    headers,
    body: "{}",
  });

  console.log(
    `   Response: HTTP ${operatorResult.status} ${operatorResult.statusText} (${operatorResult.durationMs}ms)`,
  );

  if (operatorResult.status < 200 || operatorResult.status >= 300) {
    fail(
      `Operator action failed with ${operatorResult.status} ${operatorResult.statusText}.\nBody:\n${operatorResult.bodyText}`,
    );
  }

  const operatorBody = asAdvanceTimeoutResponse(operatorResult.bodyJson);

  if (
    operatorBody.ok !== true ||
    operatorBody.action !== "advance-timeout" ||
    operatorBody.result !== "applied" ||
    operatorBody.job_id !== eligibleJob.job_id
  ) {
    fail(
      `Operator action response shape mismatch.\nBody:\n${JSON.stringify(operatorBody, null, 2)}`,
    );
  }

  console.log("✅ Operator action returned applied");

  console.log("==> Refetching run jobs after operator action");
  const jobsAfterResult = await requestJson({
    url: runJobsUrl,
    method: "GET",
    timeoutMs: cli.timeoutMs,
    headers,
  });

  if (jobsAfterResult.status < 200 || jobsAfterResult.status >= 300) {
    fail(
      `Failed to refetch run jobs.\nBody:\n${jobsAfterResult.bodyText}`,
    );
  }

  const jobsAfter = asRunJobsResponse(jobsAfterResult.bodyJson);
  const updatedJob = (jobsAfter.jobs ?? []).find(
    (job) => job.job_id === eligibleJob.job_id,
  );

  if (!updatedJob) {
    fail(`Updated job not found after operator action: ${eligibleJob.job_id}`);
  }

  console.log(
    `   Updated job status=${stringifyValue(updatedJob.status)} active_attempt=${stringifyValue(updatedJob.active_attempt)}`,
  );

  console.log("==> Fetching final trace");
  const traceResult = await requestJson({
    url: traceUrl,
    method: "GET",
    timeoutMs: cli.timeoutMs,
    headers,
  });

  if (traceResult.status < 200 || traceResult.status >= 300) {
    fail(
      `Final trace request failed with ${traceResult.status} ${traceResult.statusText}.\nBody:\n${traceResult.bodyText}`,
    );
  }

  const trace = asTraceResponse(traceResult.bodyJson);
  requireTraceEvents(trace, [
    "operator.action_requested",
    "operator.action_applied",
    "deploy.attempt_timed_out",
  ]);

  const sawRetryScheduled = (trace.events ?? []).some(
    (event) => event.event_type === "deploy.job_retry_scheduled",
  );
  const sawRetryExhausted = (trace.events ?? []).some(
    (event) => event.event_type === "deploy.job_retry_exhausted",
  );

  if (!sawRetryScheduled && !sawRetryExhausted) {
    fail(
      "Expected either deploy.job_retry_scheduled or deploy.job_retry_exhausted after operator advance-timeout.",
    );
  }

  console.log("✅ Trace contains operator and timeout milestones");

  const totalDurationMs = Date.now() - startedAt;
  console.log(`✅ Commit 7 operator action check passed in ${totalDurationMs}ms`);
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack ?? error.message : String(error);
  fail(`Unhandled error:\n${message}`);
});