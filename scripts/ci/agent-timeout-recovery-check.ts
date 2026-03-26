/* eslint-disable no-console */

type RunSummary = {
  id: string;
  run_id?: string;
  tenant?: string;
  tenant_id?: string;
  service?: string;
  service_name?: string;
  status?: string;
};

type JobSummary = {
  id: string;
  job_id?: string;
  run_id: string;
  job_type?: string;
  status?: string;
  operator_actions?: {
    can_advance_timeout?: boolean;
  };
};

type TraceEvent = {
  type: string;
  event_type?: string;
  job_id?: string;
  payload?: {
    job_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type AgentDecision = {
  runId: string;
  jobId: string;
  eligible: boolean;
  result: string;
  traceEvidence?: string[];
};

type AgentRunResponse = {
  ok: true;
  dryRun: boolean;
  decisions: AgentDecision[];
  summary: {
    actionRequested: number;
    verifiedApplied: number;
    verificationFailed: number;
    skippedCooldownActive: number;
  };
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }
  return (await response.json()) as T;
}

async function listRuns(baseUrl: string): Promise<RunSummary[]> {
  const response = await fetch(`${baseUrl}/runs`);
  const json = await readJson<unknown>(response);

  if (Array.isArray(json)) {
    return (json as RunSummary[]).map(normalizeRunSummary);
  }
  if (
    json &&
    typeof json === "object" &&
    "runs" in json &&
    Array.isArray((json as { runs?: unknown }).runs)
  ) {
    return (json as { runs: RunSummary[] }).runs.map(normalizeRunSummary);
  }

  throw new Error("Unexpected /runs response shape");
}

async function getRunJobs(baseUrl: string, runId: string): Promise<JobSummary[]> {
  const response = await fetch(`${baseUrl}/runs/${runId}/jobs`);
  const json = await readJson<unknown>(response);

  if (Array.isArray(json)) {
    return (json as JobSummary[]).map((job) => normalizeJobSummary(job, runId));
  }
  if (
    json &&
    typeof json === "object" &&
    "jobs" in json &&
    Array.isArray((json as { jobs?: unknown }).jobs)
  ) {
    return (json as { jobs: JobSummary[] }).jobs.map((job) =>
      normalizeJobSummary(job, runId)
    );
  }

  throw new Error(`Unexpected /runs/${runId}/jobs response shape`);
}

async function getTrace(baseUrl: string, runId: string): Promise<TraceEvent[]> {
  const response = await fetch(`${baseUrl}/trace/${runId}`);
  const json = await readJson<unknown>(response);

  if (Array.isArray(json)) return (json as TraceEvent[]).map(normalizeTraceEvent);
  if (
    json &&
    typeof json === "object" &&
    "events" in json &&
    Array.isArray((json as { events?: unknown }).events)
  ) {
    return (json as { events: TraceEvent[] }).events.map(normalizeTraceEvent);
  }
  if (
    json &&
    typeof json === "object" &&
    "trace" in json &&
    Array.isArray((json as { trace?: unknown }).trace)
  ) {
    return (json as { trace: TraceEvent[] }).trace.map(normalizeTraceEvent);
  }

  throw new Error(`Unexpected /trace/${runId} response shape`);
}

function normalizeRunSummary(raw: RunSummary): RunSummary {
  const id = raw.id ?? raw.run_id;
  if (!id) {
    throw new Error("Run entry missing id/run_id");
  }

  return {
    ...raw,
    id,
    tenant: raw.tenant ?? raw.tenant_id,
    service: raw.service ?? raw.service_name,
  };
}

function normalizeJobSummary(raw: JobSummary, runId: string): JobSummary {
  const id = raw.id ?? raw.job_id;
  if (!id) {
    throw new Error(`Job entry missing id/job_id for run ${runId}`);
  }

  return {
    ...raw,
    id,
    run_id: raw.run_id ?? runId,
  };
}

function normalizeTraceEvent(raw: TraceEvent): TraceEvent {
  return {
    ...raw,
    type: raw.type ?? raw.event_type ?? "",
    job_id: raw.job_id ?? raw.payload?.job_id,
  };
}

function hasTraceEvent(
  trace: TraceEvent[],
  type: string,
  jobId: string
): boolean {
  return trace.some((event) => event.type === type && event.job_id === jobId);
}

async function runAgent(agentBaseUrl: string): Promise<AgentRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run-once`, {
    method: "POST"
  });
  return readJson<AgentRunResponse>(response);
}

async function main(): Promise<void> {
  const controlPlaneBaseUrl = requireEnv("CONTROL_PLANE_BASE_URL");
  const agentBaseUrl = requireEnv("OPERATOR_AGENT_BASE_URL");

  const runs = await listRuns(controlPlaneBaseUrl);

  let eligibleRun: RunSummary | undefined;
  let eligibleJob: JobSummary | undefined;

  for (const run of runs) {
    const jobs = await getRunJobs(controlPlaneBaseUrl, run.id);
    const found = jobs.find((job) => job.operator_actions?.can_advance_timeout);

    if (found) {
      eligibleRun = run;
      eligibleJob = found;
      break;
    }
  }

  if (!eligibleRun || !eligibleJob) {
    throw new Error("No timeout-eligible job found for agent validation");
  }

  console.log("Found eligible job", {
    runId: eligibleRun.id,
    jobId: eligibleJob.id
  });

  const firstRun = await runAgent(agentBaseUrl);

  if (firstRun.dryRun) {
    throw new Error("Agent is in dry-run mode; expected apply mode for validation");
  }

  const firstDecision = firstRun.decisions.find(
    (decision) => decision.runId === eligibleRun!.id && decision.jobId === eligibleJob!.id
  );

  if (!firstDecision) {
    throw new Error("Agent response did not include the eligible job decision");
  }

  const trace = await getTrace(controlPlaneBaseUrl, eligibleRun.id);

  const requestedPresent = hasTraceEvent(
    trace,
    "operator.action_requested",
    eligibleJob.id
  );
  const appliedPresent = hasTraceEvent(
    trace,
    "operator.action_applied",
    eligibleJob.id
  );

  if (!requestedPresent || !appliedPresent) {
    throw new Error(
      `Expected trace to contain operator.action_requested and operator.action_applied for job ${eligibleJob.id}`
    );
  }

  console.log("Verified operator trace events", {
    runId: eligibleRun.id,
    jobId: eligibleJob.id
  });

  const secondRun = await runAgent(agentBaseUrl);
  const secondDecision = secondRun.decisions.find(
    (decision) => decision.runId === eligibleRun!.id && decision.jobId === eligibleJob!.id
  );

  if (!secondDecision) {
    throw new Error("Second agent run did not include the eligible job decision");
  }

  const acceptableSecondRunResults = new Set([
    "skipped_cooldown_active",
    "skipped_not_eligible",
    "skipped_budget_scan_exhausted",
    "skipped_budget_hourly_exhausted",
    "skipped_budget_tenant_hourly_exhausted"
  ]);

  if (!acceptableSecondRunResults.has(secondDecision.result)) {
    throw new Error(
      `Unexpected second-run result for job ${eligibleJob.id}: ${secondDecision.result}`
    );
  }

  console.log("Verified duplicate suppression on second run", {
    runId: eligibleRun.id,
    jobId: eligibleJob.id,
    secondRunResult: secondDecision.result
  });

  console.log("agent-timeout-recovery-check passed");
}

main().catch((error) => {
  console.error("agent-timeout-recovery-check failed");
  console.error(error);
  process.exit(1);
});
