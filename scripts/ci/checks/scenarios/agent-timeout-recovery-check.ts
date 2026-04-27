/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../../../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";

export {};

type CreateTaskResponse = {
  ok?: boolean;
  taskId?: string;
  error?: string;
};

const STAGE6_POLICY_VERSION = "commit9-stage6";
const COMPANY_ID = "company_internal_aep";
const TEAM_ID = "team_infra";
const ALLOWED_TENANTS = new Set(["tenant_internal_aep", "tenant_qa"]);
const ALLOWED_SERVICE = "service_control_plane";
const SEEDED_WORKFLOW_PROJECT_ID = "ci-agent-timeout-recovery";
type WorkflowStartResponse = {
  workflow_run_id: string;
  trace_id: string;
  status: string;
};
function isAllowedRun(run: RunSummary): boolean {
  return (
    typeof run.tenant === "string" &&
    ALLOWED_TENANTS.has(run.tenant) &&
    typeof run.service === "string" &&
    run.service === ALLOWED_SERVICE
  );
}

async function startSeededAllowedWorkflow(
  controlPlaneBaseUrl: string
): Promise<WorkflowStartResponse> {
  const response = await fetch(`${controlPlaneBaseUrl}/workflow/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tenant_id: "tenant_internal_aep",
      project_id: SEEDED_WORKFLOW_PROJECT_ID,
      repo_url: "https://github.com/example/repo",
      branch: "main",
      service_name: ALLOWED_SERVICE,
      deploy_mode: "async",
      teardown_mode: "async",
    }),
  });

  const json = await readJson<WorkflowStartResponse>(response);

  if (!json.workflow_run_id) {
    throw new Error("Seeded workflow start did not return workflow_run_id");
  }

  return json;
}

async function waitForTimeoutEligibleJob(
  controlPlaneBaseUrl: string,
  runId: string,
  attempts = 20,
  intervalMs = 1000
): Promise<JobSummary> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const jobs = await getRunJobs(controlPlaneBaseUrl, runId);
    const found = jobs.find((job) => job.operator_actions?.can_advance_timeout);

    if (found) {
      return found;
    }

    if (attempt < attempts) {
      await sleep(intervalMs);
    }
  }

  throw new Error(`Timed out waiting for timeout-eligible job for run ${runId}`);
}

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
  tenant?: string;
  service?: string;
  jobType?: string;
  jobStatus?: string;
  eligible: boolean;
  reason?: string;
  result: string;
  traceEvidence?: string[];
  errorMessage?: string;
};

type AgentRunResponse = {
  ok: true;
  status: "completed";
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

type EmployeeControlRecord = {
  employeeId: string;
  state:
    | "enabled"
    | "disabled_pending_review"
    | "disabled_by_manager"
    | "restricted";
  transition: string;
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

type EmployeeControlBlockedResponse = {
  ok: true;
  status: "skipped_disabled_by_manager" | "skipped_pending_review";
  policyVersion: string;
  trigger: string;
  employee: {
    employeeId: string;
    roleId: string;
  };
  message: string;
  control: EmployeeControlRecord;
};

type PaperclipAgentRunResponse = {
  ok: true;
  status: "completed";
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
  request: {
    companyId?: string;
    teamId?: string;
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
  teamId: string;
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
  observedEmployeeIds: string[];
  scanned: {
    workLogEntries: number;
    employeesObserved: number;
  };
  summary: {
    repeatedVerificationFailures: number;
    operatorActionFailures: number;
    budgetExhaustionSignals: number;
    reEnableDecisions: number;
    restrictionDecisions: number;
    clearedRestrictionDecisions: number;
    crossWorkerAlerts: number;
    escalationsCreated: number;
    approvalsRequested?: number;
    approvalBlockedDecisions?: number;
    approvalAppliedDecisions?: number;
    approvalExpiredBlocks?: number;
    approvalAlreadyExecutedBlocks?: number;
    decisionsEmitted: number;
  };
  decisions: ManagerDecision[];
  message: string;
  controlPlaneBaseUrl: string;
};

function isBlockedResponse(
  response: AgentRunResponse | EmployeeControlBlockedResponse
): response is EmployeeControlBlockedResponse {
  return (
    response.status === "skipped_disabled_by_manager" ||
    response.status === "skipped_pending_review"
  );
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }
  return (await response.json()) as T;
}

async function createTask(
  agentBaseUrl: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${agentBaseUrl}/agent/tasks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const parsed = await readJson<CreateTaskResponse>(response);

  if (!parsed.ok || !parsed.taskId) {
    throw new Error(`Task creation failed: ${JSON.stringify(parsed)}`);
  }

  return parsed.taskId;
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

function verifyAdvanceTimeoutApplied(
  trace: TraceEvent[],
  jobId: string
): { ok: boolean; evidence: string[] } {
  const evidence: string[] = [];

  const requested = hasTraceEvent(trace, "operator.action_requested", jobId);
  if (requested) {
    evidence.push("operator.action_requested");
  }

  const applied = hasTraceEvent(trace, "operator.action_applied", jobId);
  if (applied) {
    evidence.push("operator.action_applied");
  }

  return {
    ok: requested && applied,
    evidence,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAgent(
  agentBaseUrl: string,
  timeoutRecoveryEmployeeId: string,
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
      companyId: COMPANY_ID,
      teamId: TEAM_ID,
      employeeId: timeoutRecoveryEmployeeId,
      roleId: "timeout-recovery-operator",
      trigger: "manual",
      policyVersion: STAGE6_POLICY_VERSION,
      ...(overrides ?? {}),
    }),
  });

  return readJson<AgentRunResponse | EmployeeControlBlockedResponse>(response);
}

async function runAgentViaPaperclip(
  agentBaseUrl: string,
  taskId: string,
  timeoutRecoveryEmployeeId: string,
): Promise<PaperclipAgentRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "paperclip",
    },
    body: JSON.stringify({
      companyId: COMPANY_ID,
      teamId: TEAM_ID,
      employeeId: timeoutRecoveryEmployeeId,
      roleId: "timeout-recovery-operator",
      policyVersion: STAGE6_POLICY_VERSION,
      trigger: "paperclip",
      taskId,
      heartbeatId: "hb_stage2_smoke",
      budgetOverride: {
        maxActionsPerScan: 1,
      },
    }),
  });

  return readJson<PaperclipAgentRunResponse>(response);
}

async function runAgentCompatibility(
  agentBaseUrl: string,
  employeeId: string,
): Promise<AgentRunResponse> {
  const response = await fetch(
    `${agentBaseUrl}/agent/run-once?employeeId=${encodeURIComponent(employeeId)}`,
    {
      method: "POST",
    },
  );
  return readJson<AgentRunResponse>(response);
}

async function runManager(
  agentBaseUrl: string,
  managerEmployeeId: string,
  timeoutRecoveryEmployeeId: string,
): Promise<ManagerRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "ci-agent-timeout-recovery-check",
    },
    body: JSON.stringify({
      companyId: COMPANY_ID,
      teamId: TEAM_ID,
      employeeId: managerEmployeeId,
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: STAGE6_POLICY_VERSION,
      targetEmployeeIdOverride: timeoutRecoveryEmployeeId,
    }),
  });

  return readJson<ManagerRunResponse>(response);
}

async function getManagerLog(
  agentBaseUrl: string,
  managerEmployeeId: string,
): Promise<{
  ok: true;
  managerEmployeeId: string;
  count: number;
  entries: ManagerDecision[];
}> {
  const response = await fetch(
    `${agentBaseUrl}/agent/manager-log?managerEmployeeId=${managerEmployeeId}&limit=20`
  );
  return readJson(response);
}

async function getEmployeeControls(
  agentBaseUrl: string,
  employeeId: string,
): Promise<{
  ok: true;
  employeeId?: string;
  control?: EmployeeControlRecord | null;
  effectiveState?: {
    state:
      | "enabled"
      | "disabled_pending_review"
      | "disabled_by_manager"
      | "restricted";
    blocked: boolean;
  };
}> {
  const response = await fetch(
    `${agentBaseUrl}/agent/employee-controls?employeeId=${employeeId}`
  );
  return readJson(response);
}

async function runWorkerAfterManagerDisable(
  agentBaseUrl: string,
  timeoutRecoveryEmployeeId: string,
): Promise<EmployeeControlBlockedResponse | AgentRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "ci-agent-timeout-recovery-check",
    },
    body: JSON.stringify({
      companyId: COMPANY_ID,
      teamId: TEAM_ID,
      employeeId: timeoutRecoveryEmployeeId,
      roleId: "timeout-recovery-operator",
      trigger: "manual",
      policyVersion: STAGE6_POLICY_VERSION,
    }),
  });

  return readJson(response);
}

async function main(): Promise<void> {
  const controlPlaneBaseUrl = resolveServiceBaseUrl({
    envVar: "CONTROL_PLANE_BASE_URL",
    serviceName: "control-plane",
  });
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const liveEmployeeIds = await resolveEmployeeIdsByKey({
    agentBaseUrl,
    employees: [
      {
        key: "timeoutRecovery",
        roleId: "timeout-recovery-operator",
        teamId: TEAM_ID,
        runtimeStatus: "implemented",
      },
      {
        key: "infraOpsManager",
        roleId: "infra-ops-manager",
        teamId: TEAM_ID,
        runtimeStatus: "implemented",
      },
    ],
  });
  const timeoutRecoveryEmployeeId = liveEmployeeIds.timeoutRecovery;
  const managerEmployeeId = liveEmployeeIds.infraOpsManager;

  const overrideProbe = await runAgent(agentBaseUrl, timeoutRecoveryEmployeeId, {
    budgetOverride: {
      maxActionsPerScan: 1,
    },
  });

  if (overrideProbe.policyVersion !== STAGE6_POLICY_VERSION) {
    throw new Error(
      `Unexpected policyVersion from /agent/run: ${overrideProbe.policyVersion}`
    );
  }

  const workerDisabledAtStart = isBlockedResponse(overrideProbe);

  if (workerDisabledAtStart) {
    console.log(
      "Worker is already disabled at script start; skipping active worker action checks",
      {
        employeeId: overrideProbe.employee.employeeId,
        reason: overrideProbe.control.reason,
      }
    );
  }

  if (
    !workerDisabledAtStart &&
    overrideProbe.budget.maxActionsPerScan !== 1
  ) {
    throw new Error(
      `Expected budget override maxActionsPerScan=1, got ${overrideProbe.budget.maxActionsPerScan}`
    );
  }

  console.log("Verified /agent/run canonical path and budget override merge");

  const timeoutRecoveryTaskId = await createTask(agentBaseUrl, {
    companyId: COMPANY_ID,
    originatingTeamId: TEAM_ID,
    assignedTeamId: TEAM_ID,
    createdByEmployeeId: managerEmployeeId,
    assignedEmployeeId: timeoutRecoveryEmployeeId,
    taskType: "analysis",
    title: "Analyze agent timeout recovery",
    payload: {
      question: "Analyze timeout recovery behavior",
      scenario: "agent-timeout-recovery-check",
      employeeId: timeoutRecoveryEmployeeId,
    },
  });

  const paperclipProbe = await runAgentViaPaperclip(
    agentBaseUrl,
    timeoutRecoveryTaskId,
    timeoutRecoveryEmployeeId,
  );

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
    !isBlockedResponse(paperclipProbe.result) &&
    paperclipProbe.result.budget.maxActionsPerScan !== 1
  ) {
    throw new Error(
      `Expected paperclip budget override maxActionsPerScan=1, got ${paperclipProbe.result.budget.maxActionsPerScan}`
    );
  }

  if (paperclipProbe.taskId !== timeoutRecoveryTaskId) {
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
    console.log(
      "Starting seeded allowed-tenant workflow for deterministic timeout recovery validation"
    );

    const seeded = await startSeededAllowedWorkflow(controlPlaneBaseUrl);
    const eligibleRun: RunSummary = {
      id: seeded.workflow_run_id,
      tenant: "tenant_internal_aep",
      service: ALLOWED_SERVICE,
    };
    const eligibleJob = await waitForTimeoutEligibleJob(
      controlPlaneBaseUrl,
      seeded.workflow_run_id
    );

    console.log("Found seeded eligible job", {
      runId: eligibleRun.id,
      jobId: eligibleJob.id,
    });

    const firstRun = await runAgent(agentBaseUrl, timeoutRecoveryEmployeeId);

    if (isBlockedResponse(firstRun)) {
      throw new Error(
        `Worker unexpectedly blocked during active worker checks: ${firstRun.control.reason}`
      );
    }

    if (firstRun.dryRun) {
      throw new Error("Agent is in dry-run mode; expected apply mode for validation");
    }

    const actionLikeResults = new Set([
      "action_requested",
      "verified_applied",
    ]);

    const seededDecision = firstRun.decisions.find(
      (decision) =>
        decision.runId === eligibleRun.id && decision.jobId === eligibleJob.id
    );

    if (!seededDecision) {
      throw new Error(
        `Expected first agent run to include seeded decision for ${eligibleRun.id}/${eligibleJob.id}, got decisions: ${firstRun.decisions
          .map((d) => `${d.runId}/${d.jobId}:${d.result}${d.reason ? `:${d.reason}` : ""}`)
          .join(", ")}`
      );
    }

    if (!actionLikeResults.has(seededDecision.result)) {
      throw new Error(
        `Expected seeded timeout-recovery candidate ${eligibleRun.id}/${eligibleJob.id} to take action (action_requested or verified_applied), got ${seededDecision.result}${seededDecision.reason ? `:${seededDecision.reason}` : ""}`
      );
    }

    const firstDecision = seededDecision;
    const actedRunId = eligibleRun.id;
    const actedJobId = eligibleJob.id;

    console.log("Selected acted decision for verification", {
      runId: actedRunId,
      jobId: actedJobId,
      tenant: firstDecision.tenant,
      service: firstDecision.service,
      result: firstDecision.result,
      reason: firstDecision.reason,
    });

    let trace: TraceEvent[] = [];
    let verification = { ok: false, evidence: [] as string[] };

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      trace = await getTrace(controlPlaneBaseUrl, actedRunId);
      verification = verifyAdvanceTimeoutApplied(trace, actedJobId);

      if (verification.ok) {
        break;
      }

      if (attempt < 6) {
        await sleep(1000);
      }
    }

    if (!verification.ok) {
      throw new Error(
        `Expected trace to contain operator.action_requested and operator.action_applied for job ${actedJobId}; firstDecision.result=${firstDecision.result}; saw evidence: ${verification.evidence.join(", ") || "(none)"}`
      );
    }

    console.log("Verified operator trace events", {
      runId: actedRunId,
      jobId: actedJobId,
      firstDecisionResult: firstDecision.result,
      evidence: verification.evidence,
    });

    const secondRun = await runAgent(agentBaseUrl, timeoutRecoveryEmployeeId);
    if (isBlockedResponse(secondRun)) {
      throw new Error(
        `Worker unexpectedly blocked before second-run non-action check: ${secondRun.control.reason}`
      );
    }

    const secondDecision = secondRun.decisions.find(
      (decision) => decision.runId === actedRunId && decision.jobId === actedJobId
    );

    if (!secondDecision) {
      throw new Error("Second agent run did not include the acted job decision");
    }

    const acceptableSecondRunResults = new Set([
      "skipped_cooldown_active",
      "skipped_not_eligible",
      "skipped_tenant_not_allowed",
      "skipped_service_not_allowed",
      "skipped_budget_scan_exhausted",
      "skipped_budget_hourly_exhausted",
      "skipped_budget_tenant_hourly_exhausted",
    ]);

    if (!acceptableSecondRunResults.has(secondDecision.result)) {
      throw new Error(
        `Unexpected second-run result for job ${actedJobId}: ${secondDecision.result}`
      );
    }

    console.log("Verified second run did not re-apply the operator action", {
      runId: actedRunId,
      jobId: actedJobId,
      secondRunResult: secondDecision.result,
    });

    const compatibilityRun = await runAgentCompatibility(agentBaseUrl, timeoutRecoveryEmployeeId);

    if (!compatibilityRun.ok) {
      throw new Error("Compatibility /agent/run-once did not succeed");
    }

    console.log("Verified /agent/run-once compatibility path");
  } else {
    const compatibilityRun = await runAgentCompatibility(agentBaseUrl, timeoutRecoveryEmployeeId);
    if (!compatibilityRun.ok) {
      throw new Error("Compatibility /agent/run-once did not succeed");
    }
    console.log("Verified /agent/run-once compatibility path (worker disabled baseline)");
  }

  const managerRun = await runManager(
    agentBaseUrl,
    managerEmployeeId,
    timeoutRecoveryEmployeeId,
  );

  if (managerRun.employee.employeeId !== managerEmployeeId) {
    throw new Error(
      `Unexpected manager employeeId: ${managerRun.employee.employeeId}`
    );
  }

  if (
    !Array.isArray(managerRun.observedEmployeeIds) ||
    !managerRun.observedEmployeeIds.includes(timeoutRecoveryEmployeeId)
  ) {
    throw new Error(
      `Expected observedEmployeeIds to include ${timeoutRecoveryEmployeeId}, got ${JSON.stringify(managerRun.observedEmployeeIds)}`
    );
  }

  if (managerRun.policyVersion !== STAGE6_POLICY_VERSION) {
    throw new Error(
      `Unexpected manager policyVersion: ${managerRun.policyVersion}`
    );
  }

  const managerLog = await getManagerLog(agentBaseUrl, managerEmployeeId);

  if (!managerLog.ok) {
    throw new Error("Manager log route did not return ok=true");
  }

  console.log("Verified manager run and manager log route", {
    decisionsEmitted: managerRun.summary.decisionsEmitted,
    managerLogCount: managerLog.count,
  });

  const employeeControls = await getEmployeeControls(
    agentBaseUrl,
    timeoutRecoveryEmployeeId,
  );

  if (!employeeControls.ok) {
    throw new Error("Employee controls route did not return ok=true");
  }

  const workerEffectiveState = employeeControls.effectiveState;

  if (workerEffectiveState?.blocked) {
    const blockedRun = await runWorkerAfterManagerDisable(
      agentBaseUrl,
      timeoutRecoveryEmployeeId,
    );

    if (!isBlockedResponse(blockedRun)) {
      throw new Error(
        `Expected worker run to be blocked, got ${blockedRun.status}`
      );
    }

    console.log("Verified worker run is blocked by manager-applied local control", {
      employeeId: blockedRun.employee.employeeId,
      reason: blockedRun.control.reason,
      state: blockedRun.control.state,
    });
  } else {
    console.log("No disabling control present for worker; manager remained advisory in this run");
  }

  console.log("agent-timeout-recovery-check passed");
}

main().catch((error) => {
  if (handleOperatorAgentSoftSkip("agent-timeout-recovery-check", error)) {
    process.exit(0);
  }

  console.error("agent-timeout-recovery-check failed");
  console.error(error);
  process.exit(1);
});