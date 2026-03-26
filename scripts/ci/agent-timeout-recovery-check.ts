/* eslint-disable no-console */

export {};

const STAGE6_POLICY_VERSION = "commit9-stage6";

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
  policyVersion: string;
  dryRun: boolean;
  budget: {
    maxActionsPerScan: number;
    maxActionsPerHour: number;
    maxActionsPerTenantPerHour: number;
    tokenBudgetDaily: number;
    runtimeBudgetMsPerScan: number;
    verificationReadsPerAction: number;
  };
  decisions: AgentDecision[];
  summary: {
    actionRequested: number;
    verifiedApplied: number;
    verificationFailed: number;
    skippedCooldownActive: number;
  };
};

type PaperclipAgentRunResponse = {
  ok: true;
  status: "completed";
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  request: {
    departmentId: string;
    employeeId: string;
    roleId: string;
    trigger: string;
    policyVersion: string;
    budgetOverride?: Record<string, unknown>;
    authorityOverride?: Record<string, unknown>;
  };
  result: AgentRunResponse | EmployeeControlBlockedResponse;
};

type ManagerDecision = {
  timestamp: string;
  managerEmployeeId: string;
  managerEmployeeName: string;
  departmentId: string;
  roleId: string;
  policyVersion: string;
  employeeId: string;
  reason: string;
  recommendation: string;
  severity: string;
  message: string;
  evidence: {
    windowEntryCount: number;
    resultCounts: Record<string, number>;
  };
};

type ManagerRunResponse = {
  ok: true;
  status: "completed";
  policyVersion: string;
  trigger: string;
  employee: {
    employeeId: string;
    roleId: string;
  };
  observedEmployeeId: string;
  scanned: {
    workLogEntries: number;
  };
  summary: {
    repeatedVerificationFailures: number;
    operatorActionFailures: number;
    budgetExhaustionSignals: number;
    decisionsEmitted: number;
  };
  decisions: ManagerDecision[];
  message: string;
  controlPlaneBaseUrl: string;
};

type EmployeeControlBlockedResponse = {
  ok: true;
  status: "skipped_disabled_by_manager";
  policyVersion: string;
  trigger: string;
  employee: {
    employeeId: string;
    roleId: string;
  };
  message: string;
  control: {
    employeeId: string;
    enabled: boolean;
    updatedAt: string;
    updatedByEmployeeId: string;
    updatedByRoleId: string;
    policyVersion: string;
    reason: string;
    message: string;
    evidence?: {
      windowEntryCount: number;
      resultCounts?: Record<string, number>;
    };
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

async function runAgent(
  agentBaseUrl: string,
  overrides?: {
    budgetOverride?: Record<string, unknown>;
    authorityOverride?: Record<string, unknown>;
  }
): Promise<AgentRunResponse | EmployeeControlBlockedResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "ci-agent-timeout-recovery-check",
    },
    body: JSON.stringify({
      departmentId: "aep-infra-ops",
      employeeId: "emp_timeout_recovery_01",
      roleId: "timeout-recovery-operator",
      trigger: "manual",
      policyVersion: STAGE6_POLICY_VERSION,
      ...(overrides ?? {}),
    }),
  });

  return readJson<AgentRunResponse>(response);
}

async function runAgentViaPaperclip(
  agentBaseUrl: string
): Promise<PaperclipAgentRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "paperclip",
    },
    body: JSON.stringify({
      companyId: "paperclip-dev",
      departmentId: "aep-infra-ops",
      employeeId: "emp_timeout_recovery_01",
      roleId: "timeout-recovery-operator",
      policyVersion: STAGE6_POLICY_VERSION,
      trigger: "paperclip",
      taskId: "task_timeout_recovery_smoke",
      heartbeatId: "hb_stage2_smoke",
      budgetOverride: {
        maxActionsPerScan: 1,
      },
    }),
  });

  return readJson<PaperclipAgentRunResponse>(response);
}

async function runAgentCompatibility(agentBaseUrl: string): Promise<AgentRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run-once`, {
    method: "POST",
  });
  return readJson<AgentRunResponse>(response);
}

async function runManager(agentBaseUrl: string): Promise<ManagerRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "ci-agent-timeout-recovery-check",
    },
    body: JSON.stringify({
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: STAGE6_POLICY_VERSION,
      targetEmployeeIdOverride: "emp_timeout_recovery_01",
    }),
  });

  return readJson<ManagerRunResponse>(response);
}

async function getManagerLog(agentBaseUrl: string): Promise<{
  ok: true;
  managerEmployeeId: string;
  count: number;
  entries: ManagerDecision[];
}> {
  const response = await fetch(
    `${agentBaseUrl}/agent/manager-log?managerEmployeeId=emp_infra_ops_manager_01&limit=20`
  );
  return readJson(response);
}

async function getEmployeeControls(agentBaseUrl: string): Promise<{
  ok: true;
  count?: number;
  entries?: Array<{
    employeeId: string;
    control: {
      employeeId: string;
      enabled: boolean;
      updatedByEmployeeId: string;
      reason: string;
    } | null;
  }>;
  employeeId?: string;
  control?: {
    employeeId: string;
    enabled: boolean;
    updatedByEmployeeId: string;
    reason: string;
  } | null;
}> {
  const response = await fetch(
    `${agentBaseUrl}/agent/employee-controls?employeeId=emp_timeout_recovery_01`
  );
  return readJson(response);
}

async function runWorkerAfterManagerDisable(
  agentBaseUrl: string
): Promise<EmployeeControlBlockedResponse | AgentRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "ci-agent-timeout-recovery-check",
    },
    body: JSON.stringify({
      departmentId: "aep-infra-ops",
      employeeId: "emp_timeout_recovery_01",
      roleId: "timeout-recovery-operator",
      trigger: "manual",
      policyVersion: STAGE6_POLICY_VERSION,
    }),
  });

  return readJson(response);
}

async function main(): Promise<void> {
  const controlPlaneBaseUrl = requireEnv("CONTROL_PLANE_BASE_URL");
  const agentBaseUrl = requireEnv("OPERATOR_AGENT_BASE_URL");

  const overrideProbe = await runAgent(agentBaseUrl, {
    budgetOverride: {
      maxActionsPerScan: 1,
    },
  });

  if (overrideProbe.policyVersion !== STAGE6_POLICY_VERSION) {
    throw new Error(
      `Unexpected policyVersion from /agent/run: ${overrideProbe.policyVersion}`
    );
  }

  const workerDisabledAtStart =
    "status" in overrideProbe &&
    overrideProbe.status === "skipped_disabled_by_manager";

  if (workerDisabledAtStart) {
    console.log("Worker is already disabled at script start; skipping active worker action checks", {
      employeeId: overrideProbe.employee.employeeId,
      reason: overrideProbe.control.reason,
    });
  }

  if (
    !workerDisabledAtStart &&
    !("status" in overrideProbe) &&
    overrideProbe.budget.maxActionsPerScan !== 1
  ) {
    throw new Error(
      `Expected budget override maxActionsPerScan=1, got ${overrideProbe.budget.maxActionsPerScan}`
    );
  }

  console.log("Verified /agent/run canonical path and budget override merge");

  const paperclipProbe = await runAgentViaPaperclip(agentBaseUrl);

  if (paperclipProbe.request.trigger !== "paperclip") {
    throw new Error(
      `Expected paperclip-adapted request trigger=paperclip, got ${paperclipProbe.request.trigger}`
    );
  }

  if (paperclipProbe.request.policyVersion !== STAGE6_POLICY_VERSION) {
    throw new Error(
      `Unexpected policyVersion from paperclip path: ${paperclipProbe.request.policyVersion}`
    );
  }

  if (
    !("status" in paperclipProbe.result) &&
    paperclipProbe.result.budget.maxActionsPerScan !== 1
  ) {
    throw new Error(
      `Expected paperclip budget override maxActionsPerScan=1, got ${paperclipProbe.result.budget.maxActionsPerScan}`
    );
  }

  if (paperclipProbe.taskId !== "task_timeout_recovery_smoke") {
    throw new Error(
      `Unexpected paperclip taskId in response: ${paperclipProbe.taskId}`
    );
  }

  if (paperclipProbe.heartbeatId !== "hb_stage2_smoke") {
    throw new Error(
      `Unexpected paperclip heartbeatId in response: ${paperclipProbe.heartbeatId}`
    );
  }

  console.log("Verified paperclip adapter request/response path");

  if (!workerDisabledAtStart) {
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

    if ("status" in firstRun) {
      throw new Error(
        `Worker unexpectedly disabled during active worker checks: ${firstRun.control.reason}`
      );
    }

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
    if ("status" in secondRun) {
      throw new Error(
        `Worker unexpectedly disabled before second-run non-action check: ${secondRun.control.reason}`
      );
    }

    const secondDecision = secondRun.decisions.find(
      (decision) => decision.runId === eligibleRun!.id && decision.jobId === eligibleJob!.id
    );

    if (!secondDecision) {
      throw new Error("Second agent run did not include the eligible job decision");
    }

  const acceptableSecondRunResults = new Set([
    "skipped_cooldown_active",
    "skipped_not_eligible",
    "skipped_tenant_not_allowed",
    "skipped_service_not_allowed",
    "skipped_budget_scan_exhausted",
    "skipped_budget_hourly_exhausted",
    "skipped_budget_tenant_hourly_exhausted"
  ]);

    if (!acceptableSecondRunResults.has(secondDecision.result)) {
      throw new Error(
        `Unexpected second-run result for job ${eligibleJob.id}: ${secondDecision.result}`
      );
    }

    console.log("Verified second run did not re-apply the operator action", {
      runId: eligibleRun.id,
      jobId: eligibleJob.id,
      secondRunResult: secondDecision.result
    });

    const compatibilityRun = await runAgentCompatibility(agentBaseUrl);

    if (!compatibilityRun.ok) {
      throw new Error("Compatibility /agent/run-once did not succeed");
    }

    console.log("Verified /agent/run-once compatibility path");
  } else {
    const compatibilityRun = await runAgentCompatibility(agentBaseUrl);
    if (!compatibilityRun.ok) {
      throw new Error("Compatibility /agent/run-once did not succeed");
    }
    console.log("Verified /agent/run-once compatibility path (worker disabled baseline)");
  }

  const managerRun = await runManager(agentBaseUrl);

  if (managerRun.employee.employeeId !== "emp_infra_ops_manager_01") {
    throw new Error(
      `Unexpected manager employeeId: ${managerRun.employee.employeeId}`
    );
  }

  if (managerRun.observedEmployeeId !== "emp_timeout_recovery_01") {
    throw new Error(
      `Unexpected observedEmployeeId: ${managerRun.observedEmployeeId}`
    );
  }

  if (managerRun.policyVersion !== STAGE6_POLICY_VERSION) {
    throw new Error(
      `Unexpected manager policyVersion: ${managerRun.policyVersion}`
    );
  }

  const managerLog = await getManagerLog(agentBaseUrl);

  if (!managerLog.ok) {
    throw new Error("Manager log route did not return ok=true");
  }

  console.log("Verified manager run and manager log route", {
    decisionsEmitted: managerRun.summary.decisionsEmitted,
    managerLogCount: managerLog.count,
  });

  const employeeControls = await getEmployeeControls(agentBaseUrl);

  if (!employeeControls.ok) {
    throw new Error("Employee controls route did not return ok=true");
  }

  const workerControl = employeeControls.control;
  if (workerControl && workerControl.enabled === false) {
    const blockedRun = await runWorkerAfterManagerDisable(agentBaseUrl);

    if (
      !("status" in blockedRun) ||
      blockedRun.status !== "skipped_disabled_by_manager"
    ) {
      throw new Error(
        `Expected worker run to be skipped_disabled_by_manager, got ${
          "status" in blockedRun ? blockedRun.status : "unknown"
        }`
      );
    }

    console.log("Verified worker run is blocked by manager-applied local control", {
      employeeId: blockedRun.employee.employeeId,
      reason: blockedRun.control.reason,
    });
  } else {
    console.log("No disabling control present for worker; manager remained advisory in this run");
  }

  console.log("agent-timeout-recovery-check passed");
}

main().catch((error) => {
  console.error("agent-timeout-recovery-check failed");
  console.error(error);
  process.exit(1);
});
