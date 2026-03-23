#!/usr/bin/env node

/**
 * scripts/ci/async-deploy-check.ts
 *
 * Validates async deploy orchestration end-to-end:
 * - starts a workflow with deploy_mode=async
 * - polls until DEPLOY enters waiting
 * - fetches trace data
 * - extracts deploy job id + dev callback token from trace
 * - runs the node deploy runner with callback arguments
 * - if teardown_mode=async, waits for TEARDOWN to enter waiting
 * - extracts teardown job id + dev callback token from trace
 * - runs the node teardown runner with callback arguments
 * - polls workflow to completed
 * - verifies key workflow steps and key trace milestones
 * 
 * Example:
 *
 *   npx tsx scripts/ci/async-deploy-check.ts \
 *     --base-url https://sample-worker-run_stagging.guybubba.workers.dev \
 *     --env dev \
 *     --provider cloudflare \
 *     --service-name sample-worker \
 *     --payload '{"tenant_id":"t_demo","project_id":"p_demo","repo_url":"https://github.com/example/repo","branch":"main","service_name":"sample-worker","deploy_mode":"async","teardown_mode":"async"}' \ 
 *     --poll-attempts 20 \
 *     --poll-interval-ms 3000
 */

import { spawn } from "node:child_process";

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
  deployRunnerPath: string;
  teardownRunnerPath: string;
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
        "  npx tsx scripts/ci/async-deploy-check.ts --base-url https://staging.example.com --env dev",
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
    pollIntervalMs: parsePositiveInt(args.get("poll-interval-ms") ?? "3000", "poll-interval-ms"),
    deployRunnerPath: args.get("deploy-runner-path") ?? "scripts/deploy/run-node-deploy.ts",
    teardownRunnerPath: args.get("teardown-runner-path") ?? "scripts/deploy/run-node-teardown.ts",
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
    "user-agent": "aep-ci-async-deploy-check/1.0",
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
    fail("Start response was not valid JSON object.");
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

function getStepStatus(workflow: WorkflowStatusResponse, stepName: string): string | undefined {
  const steps = workflow.steps ?? [];
  const step = steps.find((s) => s.step_name === stepName);
  return step?.status;
}

function getRunStatus(workflow: WorkflowStatusResponse): string | undefined {
  return workflow.run?.status;
}

function getPayloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value ? value : undefined;
}

function payloadHasJobType(
  payload: Record<string, unknown>,
  jobType: "deploy_preview" | "teardown_preview",
): boolean {
  return payload["job_type"] === jobType;
}

function payloadHasModeAsync(payload: Record<string, unknown>): boolean {
  return payload["mode"] === "async";
}

function extractJobIdAndToken(
  trace: TraceResponse,
  phase: "deploy" | "teardown",
): {
  jobId?: string;
  callbackToken?: string;
} {
  const events = trace.events ?? [];

  let jobId: string | undefined;
  let callbackToken: string | undefined;

  for (const event of events) {
    const eventType = event.event_type ?? "";
    const payload = getTraceEventPayload(event);

    if (!jobId) {
      if (phase === "deploy") {
        if (
          eventType === "deploy.job_dispatched" ||
          (eventType === "deploy_job.created" && payloadHasJobType(payload, "deploy_preview"))
        ) {
          jobId = getPayloadString(payload, "job_id");
        }
      } else {
        if (
          eventType === "teardown.job_dispatched" ||
          (eventType === "deploy_job.created" && payloadHasJobType(payload, "teardown_preview"))
        ) {
          jobId = getPayloadString(payload, "job_id");
        }
      }
    }

    if (!callbackToken && eventType === "deploy_job.debug_token") {
      const tokenJobId = getPayloadString(payload, "job_id");
      const token = getPayloadString(payload, "callback_token");

      if (jobId && tokenJobId === jobId && token) {
        callbackToken = token;
      }
    }

    if (jobId && callbackToken) {
      break;
    }
  }

  return { jobId, callbackToken };
}

async function runNodeDeploy(args: {
  deployRunnerPath: string;
  serviceName: string;
  workflowRunId: string;
  provider: string;
  jobId: string;
  callbackUrl: string;
  callbackToken: string;
}): Promise<void> {
  const commandArgs = [
    "tsx",
    args.deployRunnerPath,
    "--service-name",
    args.serviceName,
    "--workflow-run-id",
    args.workflowRunId,
    "--provider",
    args.provider,
    "--job-id",
    args.jobId,
    "--callback-url",
    args.callbackUrl,
    "--callback-token",
    args.callbackToken,
  ];

  console.log("🚀 Running node deploy runner");
  console.log(`   Command: npx ${commandArgs.join(" ")}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", commandArgs, {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

    child.on("error", reject);

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Deploy runner terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Deploy runner exited with code ${code ?? "unknown"}`));
        return;
      }
      resolve();
    });
  });
}

async function runNodeTeardown(args: {
  teardownRunnerPath: string;
  provider: string;
  deploymentRef: string;
  callbackUrl: string;
  callbackToken: string;
}): Promise<void> {
  const commandArgs = [
    "tsx",
    args.teardownRunnerPath,
    "--deployment-ref",
    args.deploymentRef,
    "--provider",
    args.provider,
    "--callback-url",
    args.callbackUrl,
    "--callback-token",
    args.callbackToken,
  ];

  console.log("🧹 Running node teardown runner");
  console.log(`   Command: npx ${commandArgs.join(" ")}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", commandArgs, {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

    child.on("error", reject);

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Teardown runner terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Teardown runner exited with code ${code ?? "unknown"}`));
        return;
      }
      resolve();
    });
  });
}

function requireTraceEvents(trace: TraceResponse, required: string[]): void {
  const seen = new Set((trace.events ?? []).map((e) => e.event_type).filter(Boolean) as string[]);
  const missing = required.filter((name) => !seen.has(name));

  if (missing.length > 0) {
    fail(`Missing expected trace events: ${missing.join(", ")}`);
  }
}

function requireCompletedSteps(workflow: WorkflowStatusResponse, required: string[]): void {
  const missing = required.filter((stepName) => getStepStatus(workflow, stepName) !== "completed");
  if (missing.length > 0) {
    fail(`Expected completed steps missing or incomplete: ${missing.join(", ")}`);
  }
}

function extractDeploymentRefFromTrace(trace: TraceResponse): string | undefined {
  const events = trace.events ?? [];

  for (const event of events) {
    const payload = getTraceEventPayload(event);
    const deploymentRef = getPayloadString(payload, "deployment_ref");
    if (deploymentRef) {
      return deploymentRef;
    }
  }

  return undefined;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const cli = parseArgs(process.argv.slice(2));
  const headers = buildHeaders(cli.env);

  console.log("🔁 AEP async deploy check");
  console.log(`   Env:           ${cli.env ?? "(not enforced)"}`);
  console.log(`   Base URL:      ${cli.baseUrl}`);
  console.log(`   Provider:      ${cli.provider}`);
  console.log(`   Service name:  ${cli.serviceName}`);
  console.log(`   Timeout:       ${cli.timeoutMs}ms`);
  console.log(`   Poll attempts: ${cli.pollAttempts}`);
  console.log(`   Poll interval: ${cli.pollIntervalMs}ms`);

  const startUrl = joinUrl(cli.baseUrl, "/workflow/start");
  console.log("==> Starting async deploy workflow");

  let startResult: RequestResult;
  try {
    startResult = await requestJson({
      url: startUrl,
      method: "POST",
      timeoutMs: cli.timeoutMs,
      headers,
      body: cli.payload,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error while starting workflow";
    fail(`Initial async deploy request failed: ${message}`);
  }

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

  const workflowUrl = joinUrl(cli.baseUrl, `/workflow/${encodeURIComponent(start.workflow_run_id)}`);
  const traceUrl = joinUrl(cli.baseUrl, `/trace/${encodeURIComponent(start.trace_id)}`);

  console.log("==> Polling until DEPLOY enters waiting");
  let waitingWorkflow: WorkflowStatusResponse | undefined;

  for (let attempt = 1; attempt <= cli.pollAttempts; attempt += 1) {
    const result = await requestJson({
      url: workflowUrl,
      method: "GET",
      timeoutMs: cli.timeoutMs,
      headers,
    });

    if (result.status < 200 || result.status >= 300) {
      console.warn(
        `⚠️  Poll attempt ${attempt}/${cli.pollAttempts} returned ${result.status} ${result.statusText}`,
      );
      console.warn(result.bodyText);
    } else {
      const workflow = asWorkflowStatusResponse(result.bodyJson);
      const runStatus = stringifyValue(getRunStatus(workflow));
      const deployStatus = stringifyValue(getStepStatus(workflow, "DEPLOY"));

      console.log(
        `   Attempt ${attempt}/${cli.pollAttempts}: run.status=${runStatus}, DEPLOY=${deployStatus}, time=${result.durationMs}ms`,
      );

      if (runStatus === "failed" || runStatus === "cancelled") {
        fail(
          `Workflow ended early with status '${runStatus}'.\nResponse:\n${JSON.stringify(workflow, null, 2)}`,
        );
      }

      if (deployStatus === "waiting") {
        waitingWorkflow = workflow;
        break;
      }
    }

    if (attempt < cli.pollAttempts) {
      await sleep(cli.pollIntervalMs);
    }
  }

  if (!waitingWorkflow) {
    fail("DEPLOY never reached waiting state.");
  }

  console.log("✅ DEPLOY entered waiting");

  console.log("==> Fetching trace and extracting job id + callback token");
  let jobId: string | undefined;
  let callbackToken: string | undefined;

  for (let attempt = 1; attempt <= cli.pollAttempts; attempt += 1) {
    const traceResult = await requestJson({
      url: traceUrl,
      method: "GET",
      timeoutMs: cli.timeoutMs,
      headers,
    });

    if (traceResult.status < 200 || traceResult.status >= 300) {
      console.warn(
        `⚠️  Trace attempt ${attempt}/${cli.pollAttempts} returned ${traceResult.status} ${traceResult.statusText}`,
      );
      console.warn(traceResult.bodyText);
    } else {
      const trace = asTraceResponse(traceResult.bodyJson);
      const extracted = extractJobIdAndToken(trace, "deploy");

      jobId = extracted.jobId;
      callbackToken = extracted.callbackToken;

      console.log(
        `   Trace attempt ${attempt}/${cli.pollAttempts}: job_id=${jobId ?? "(missing)"}, callback_token=${callbackToken ? "<present>" : "(missing)"}`,
      );

      if (jobId && callbackToken) {
        break;
      }
    }

    if (attempt < cli.pollAttempts) {
      await sleep(cli.pollIntervalMs);
    }
  }

  if (!jobId) {
    fail(
      "Could not extract job_id from trace. Expected deploy.job_dispatched or deploy_job.created event with payload_json.",
    );
  }

  if (!callbackToken) {
    fail(
      "Could not extract callback_token from trace. Expected deploy_job.debug_token event in dev.",
    );
  }

  const callbackUrl = joinUrl(
    cli.baseUrl,
    `/internal/deploy-jobs/${encodeURIComponent(jobId)}/callback`,
  );

  console.log(`   Job id:       ${jobId}`);
  console.log(`   Callback URL: ${callbackUrl}`);
  console.log("   Callback token: <redacted>");

  await runNodeDeploy({
    deployRunnerPath: cli.deployRunnerPath,
    serviceName: cli.serviceName,
    workflowRunId: start.workflow_run_id,
    provider: cli.provider,
    jobId,
    callbackUrl,
    callbackToken,
  });

  console.log("==> Polling workflow after deploy callback");
  let finalWorkflow: WorkflowStatusResponse | undefined;
  let teardownWaiting = false;

  for (let attempt = 1; attempt <= cli.pollAttempts; attempt += 1) {
    const result = await requestJson({
      url: workflowUrl,
      method: "GET",
      timeoutMs: cli.timeoutMs,
      headers,
    });

    if (result.status < 200 || result.status >= 300) {
      console.warn(
        `⚠️  Post-deploy poll ${attempt}/${cli.pollAttempts} returned ${result.status} ${result.statusText}`,
      );
      console.warn(result.bodyText);
    } else {
      const workflow = asWorkflowStatusResponse(result.bodyJson);
      const runStatus = stringifyValue(getRunStatus(workflow));
      const teardownStatus = stringifyValue(getStepStatus(workflow, "TEARDOWN"));

      console.log(
        `   Attempt ${attempt}/${cli.pollAttempts}: run.status=${runStatus}, TEARDOWN=${teardownStatus}, time=${result.durationMs}ms`,
      );

      if (runStatus === "failed" || runStatus === "cancelled") {
        fail(
          `Workflow ended in failure state '${runStatus}'.\nResponse:\n${JSON.stringify(workflow, null, 2)}`,
        );
      }

      if (runStatus === "completed") {
        finalWorkflow = workflow;
        break;
      }

      if (teardownStatus === "waiting") {
        teardownWaiting = true;
        break;
      }
    }

    if (attempt < cli.pollAttempts) {
      await sleep(cli.pollIntervalMs);
    }
  }

  if (teardownWaiting) {
    console.log("✅ TEARDOWN entered waiting");

    let teardownJobId: string | undefined;
    let teardownCallbackToken: string | undefined;

    for (let attempt = 1; attempt <= cli.pollAttempts; attempt += 1) {
      const traceResult = await requestJson({
        url: traceUrl,
        method: "GET",
        timeoutMs: cli.timeoutMs,
        headers,
      });

      if (traceResult.status < 200 || traceResult.status >= 300) {
        console.warn(
          `⚠️  Teardown trace attempt ${attempt}/${cli.pollAttempts} returned ${traceResult.status} ${traceResult.statusText}`,
        );
        console.warn(traceResult.bodyText);
      } else {
        const trace = asTraceResponse(traceResult.bodyJson);
        const extracted = extractJobIdAndToken(trace, "teardown");

        teardownJobId = extracted.jobId;
        teardownCallbackToken = extracted.callbackToken;

        console.log(
          `   Teardown trace attempt ${attempt}/${cli.pollAttempts}: job_id=${teardownJobId ?? "(missing)"}, callback_token=${teardownCallbackToken ? "<present>" : "(missing)"}`,
        );

        if (teardownJobId && teardownCallbackToken) {
          const deploymentRef = extractDeploymentRefFromTrace(trace);
          if (!deploymentRef) {
            fail("Could not extract deployment_ref from trace for teardown.");
          }

          const teardownCallbackUrl = joinUrl(
            cli.baseUrl,
            `/internal/deploy-jobs/${encodeURIComponent(teardownJobId)}/callback`,
          );

          await runNodeTeardown({
            teardownRunnerPath: cli.teardownRunnerPath,
            provider: cli.provider,
            deploymentRef,
            callbackUrl: teardownCallbackUrl,
            callbackToken: teardownCallbackToken,
          });

          break;
        }
      }

      if (attempt < cli.pollAttempts) {
        await sleep(cli.pollIntervalMs);
      }
    }

    if (!teardownJobId) {
      fail(
        "Could not extract teardown job_id from trace. Expected teardown.job_dispatched or deploy_job.created(teardown_preview).",
      );
    }

    if (!teardownCallbackToken) {
      fail(
        "Could not extract teardown callback_token from trace. Expected deploy_job.debug_token event in dev.",
      );
    }

    console.log("==> Polling workflow to completed after teardown callback");

    for (let attempt = 1; attempt <= cli.pollAttempts; attempt += 1) {
      const result = await requestJson({
        url: workflowUrl,
        method: "GET",
        timeoutMs: cli.timeoutMs,
        headers,
      });

      if (result.status < 200 || result.status >= 300) {
        console.warn(
          `⚠️  Final completion poll ${attempt}/${cli.pollAttempts} returned ${result.status} ${result.statusText}`,
        );
        console.warn(result.bodyText);
      } else {
        const workflow = asWorkflowStatusResponse(result.bodyJson);
        const runStatus = stringifyValue(getRunStatus(workflow));

        console.log(
          `   Attempt ${attempt}/${cli.pollAttempts}: run.status=${runStatus}, time=${result.durationMs}ms`,
        );

        if (runStatus === "failed" || runStatus === "cancelled") {
          fail(
            `Workflow ended in failure state '${runStatus}'.\nResponse:\n${JSON.stringify(workflow, null, 2)}`,
          );
        }

        if (runStatus === "completed") {
          finalWorkflow = workflow;
          break;
        }
      }

      if (attempt < cli.pollAttempts) {
        await sleep(cli.pollIntervalMs);
      }
    }
  }

  if (!finalWorkflow) {
    fail(`Workflow did not complete after ${cli.pollAttempts} attempts.`);
  }

  requireCompletedSteps(finalWorkflow, [
    "INIT",
    "CREATE_ENV",
    "DEPLOY",
    "HEALTH_CHECK",
    "SMOKE_TEST",
    "TEARDOWN",
    "CLEANUP_AUDIT",
    "COMPLETE",
  ]);

  console.log("✅ All expected workflow steps completed");

  console.log("==> Fetching final trace");
  const finalTraceResult = await requestJson({
    url: traceUrl,
    method: "GET",
    timeoutMs: cli.timeoutMs,
    headers,
  });

  if (finalTraceResult.status < 200 || finalTraceResult.status >= 300) {
    fail(
      `Final trace request failed with ${finalTraceResult.status} ${finalTraceResult.statusText}.\nBody:\n${finalTraceResult.bodyText}`,
    );
  }

  const finalTrace = asTraceResponse(finalTraceResult.bodyJson);
  requireTraceEvents(finalTrace, [
    "workflow.started",
    "deploy_job.created",
    "deploy.job_dispatched",
    "workflow.resumed",
    "health_check.passed",
    "smoke_test.passed",
    "workflow.completed",
  ]);

  console.log("✅ All expected trace milestones found");

  const totalDurationMs = Date.now() - startedAt;
  console.log(`✅ Async deploy check passed in ${totalDurationMs}ms`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  fail(`Unhandled error:\n${message}`);
});