/* eslint-disable no-console */

import { resolveServiceBaseUrl } from "../../../lib/service-map";
import {
  classifyOperatorAgentInfraError,
  handleOperatorAgentSoftSkip,
} from "../../../lib/operator-agent-skip";
import { resolveEmployeeIdByRole } from "../../lib/employee-resolution";

export {};

type RunEnvelope = {
  ok?: boolean;
  executionContext?: ExecutionContextEnvelope;
  result?: {
    summary?: {
      decisionsEmitted?: number;
      escalationsCreated?: number;
    };
  };
};

type ExecutionContextEnvelope = {
  executionSource?: string;
  companyId?: string;
  taskId?: string;
  heartbeatId?: string;
};

type ManagerLogEnvelope = {
  entries?: Array<{
    executionContext?: ExecutionContextEnvelope;
  }>;
};

type EscalationsEnvelope = {
  entries?: Array<{
    companyId?: string;
    executionContext?: ExecutionContextEnvelope;
  }>;
};

type WorkLogEnvelope = {
  entries?: Array<{
    executionContext?: ExecutionContextEnvelope;
  }>;
};

type SeedEnvelope = {
  ok?: boolean;
  seeded?: number;
  error?: string;
  raw?: string;
};

type CreateTaskEnvelope = {
  ok?: boolean;
  taskId?: string;
  error?: string;
};

const WORKER_CRON = "* * * * *";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function readJson(response: Response): Promise<unknown> {
  const body = await response.text();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return { raw: body };
  }
}

async function postRun(
  agentBaseUrl: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    json: await readJson(response),
  };
}

async function postRunUntilStatus(args: {
  agentBaseUrl: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  expectedStatus: number;
  label: string;
  attempts?: number;
  intervalMs?: number;
}): Promise<{ status: number; json: unknown }> {
  const attempts = args.attempts ?? Number(process.env.AEP_POLL_ATTEMPTS ?? 20);
  const intervalMs =
    args.intervalMs ?? Number(process.env.AEP_POLL_INTERVAL_MS ?? 300);

  let last: { status: number; json: unknown } | undefined;

  for (let index = 0; index < attempts; index += 1) {
    last = await postRun(args.agentBaseUrl, args.body, args.headers);
    if (last.status === args.expectedStatus) {
      return last;
    }
    if (index < attempts - 1) {
      await sleep(intervalMs);
    }
  }

  throw new Error(
    `${args.label} did not return ${args.expectedStatus} after ${attempts} attempts (${attempts * intervalMs}ms). Last status=${String(last?.status)}, last body=${summarizeForError(last?.json)}`
  );
}

async function getJson(url: string): Promise<{ status: number; json: unknown }> {
  const response = await fetch(url);
  return {
    status: response.status,
    json: await readJson(response),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeForError(value: unknown): string {
  try {
    const raw = JSON.stringify(value);
    return raw.length > 240 ? `${raw.slice(0, 240)}...` : raw;
  } catch {
    return String(value);
  }
}

async function waitForJsonMatch<T>(args: {
  label: string;
  url: string;
  attempts?: number;
  intervalMs?: number;
  matches: (json: unknown) => json is T;
}): Promise<T> {
  const attempts = args.attempts ?? Number(process.env.AEP_POLL_ATTEMPTS ?? 20);
  const intervalMs =
    args.intervalMs ?? Number(process.env.AEP_POLL_INTERVAL_MS ?? 300);

  let lastStatus = 0;
  let lastJson: unknown;

  for (let index = 0; index < attempts; index += 1) {
    const response = await getJson(args.url);
    lastStatus = response.status;
    lastJson = response.json;

    if (response.status === 200 && args.matches(response.json)) {
      return response.json;
    }

    if (index < attempts - 1) {
      await sleep(intervalMs);
    }
  }

  throw new Error(
    `${args.label} not observed after ${attempts} attempts (${attempts * intervalMs}ms). Last status=${lastStatus}, last body=${summarizeForError(lastJson)}`
  );
}

function managerSignalsFromRun(run: RunEnvelope): {
  decisionsEmitted: number;
  escalationsCreated: number;
} {
  return {
    decisionsEmitted: Number(run.result?.summary?.decisionsEmitted ?? 0),
    escalationsCreated: Number(run.result?.summary?.escalationsCreated ?? 0),
  };
}

type SeedPathDiagnostic = {
  path: string;
  status: number;
  contentType: string;
  cfRay: string;
  server: string;
  retryAfter: string;
  bodySnippet: string;
};

async function collectSeedDiagnostic(
  response: Response,
  path: string
): Promise<SeedPathDiagnostic> {
  const body = await response.text();
  return {
    path,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    cfRay: response.headers.get("cf-ray") ?? "",
    server: response.headers.get("server") ?? "",
    retryAfter: response.headers.get("retry-after") ?? "",
    bodySnippet: body.slice(0, 300),
  };
}

function diagnosticToErrorString(d: SeedPathDiagnostic): string {
  const parts = [
    `path=${d.path}`,
    `status=${d.status}`,
    d.cfRay ? `cf-ray=${d.cfRay}` : "",
    d.retryAfter ? `retry-after=${d.retryAfter}` : "",
    `body=${d.bodySnippet}`,
  ].filter(Boolean);
  return parts.join(" ");
}

async function seedWorkLog(
  agentBaseUrl: string,
  body: Record<string, unknown>
): Promise<SeedEnvelope> {
  const seedPaths = ["/agent/work-log/seed", "/agent/te/seed-work-log"];
  const failures: SeedPathDiagnostic[] = [];

  for (const seedPath of seedPaths) {
    const response = await fetch(`${agentBaseUrl}${seedPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const parsed = (await readJson(response)) as SeedEnvelope;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Seed endpoint returned a non-object response");
      }
      return parsed;
    }

    failures.push(await collectSeedDiagnostic(response, seedPath));
  }

  // Classify across all collected failures
  const hasRateLimit = failures.some(
    (f) => {
      const lower = f.bodySnippet.toLowerCase();
      return (
        f.status === 429 ||
        lower.includes("rate limit") ||
        lower.includes("too many requests") ||
        lower.includes("quota") ||
        lower.includes("limit exceeded") ||
        lower.includes("kv put() limit exceeded") ||
        lower.includes("kv put limit exceeded") ||
        lower.includes("kv_write_failed")
      );
    }
  );
  const hasCloudflarePlaceholder404 = failures.some(
    (f) =>
      f.status === 404 &&
      (f.bodySnippet.includes("<!DOCTYPE html") ||
        f.bodySnippet.includes("<html")) &&
      (f.bodySnippet.includes("Cloudflare") ||
        f.bodySnippet.includes("There is nothing here yet") ||
        f.bodySnippet.includes("The resource you are looking for"))
  );
  const allCloudflareEdgeErrors = failures.every(
    (f) =>
      [500, 502, 503, 504].includes(f.status) &&
      (f.bodySnippet.includes("<!DOCTYPE html") ||
        f.bodySnippet.includes("Cloudflare"))
  );
  const hasPlain404 = failures.some(
    (f) =>
      f.status === 404 &&
      !f.bodySnippet.includes("<!DOCTYPE html") &&
      !f.bodySnippet.includes("<html")
  );

  const rateFailure = failures.find(
    (f) =>
      f.status === 429 ||
      f.bodySnippet.toLowerCase().includes("rate limit") ||
      f.bodySnippet.toLowerCase().includes("too many requests") ||
      f.bodySnippet.toLowerCase().includes("quota")
  );

  if (hasRateLimit && rateFailure) {
    throw new Error(
      `[rate-limited] operator-agent write/test path is rate-limited or quota-limited — ` +
        `read-only surface may still be healthy; ` +
        `path=${rateFailure.path} status=${rateFailure.status}` +
        (rateFailure.cfRay ? ` cf-ray=${rateFailure.cfRay}` : "") +
        (rateFailure.retryAfter ? ` retry-after=${rateFailure.retryAfter}` : "")
    );
  }

  if (hasCloudflarePlaceholder404) {
    throw new Error(
      `[not-deployed] operator-agent not deployed or route not attached at ${agentBaseUrl} — ` +
        failures.map(diagnosticToErrorString).join(" | ")
    );
  }

  if (allCloudflareEdgeErrors && failures.length > 0) {
    throw new Error(
      `[cloudflare-edge-error] Cloudflare edge degraded for operator-agent seed path — ` +
        failures.map(diagnosticToErrorString).join(" | ")
    );
  }

  if (hasPlain404) {
    throw new Error(
      "Seed endpoint returned 404 — start the operator-agent with --var ENABLE_TEST_ENDPOINTS:true"
    );
  }

  throw new Error(
    `Seed endpoint failed across all paths — ` +
      failures.map(diagnosticToErrorString).join(" | ")
  );
}

async function createTask(
  agentBaseUrl: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${agentBaseUrl}/agent/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = (await readJson(response)) as CreateTaskEnvelope;

  if (response.status !== 201 || !parsed?.ok || !parsed.taskId) {
    throw new Error(
      `Task creation failed: status=${response.status}, body=${summarizeForError(parsed)}`
    );
  }

  return parsed.taskId;
}

async function triggerScheduled(
  agentBaseUrl: string,
  cron: string,
  scheduledTimeMs?: number,
): Promise<{ status: number }> {
  const query = new URLSearchParams({
    cron,
    ...(typeof scheduledTimeMs === "number" && Number.isFinite(scheduledTimeMs)
      ? { scheduledTime: String(Math.trunc(scheduledTimeMs)) }
      : {}),
  });
  const url = `${agentBaseUrl}/__scheduled?${query.toString()}`;
  const response = await fetch(url, { method: "POST" });
  return { status: response.status };
}

function alignScheduledTimeForMinuteInterval(
  intervalMinutes: number,
  referenceMs = Date.now(),
): number {
  const safeInterval =
    Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? Math.trunc(intervalMinutes)
      : 1;

  const date = new Date(referenceMs);
  const minute = date.getUTCMinutes();
  const minuteOffset = (safeInterval - (minute % safeInterval)) % safeInterval;

  date.setUTCMinutes(minute + minuteOffset, 0, 0);

  return date.getTime();
}

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const managerEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "infra-ops-manager",
    teamId: "team_infra",
    runtimeStatus: "implemented",
  });
  const timeoutRecoveryEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "timeout-recovery-operator",
    teamId: "team_infra",
    runtimeStatus: "implemented",
  });
  const retrySupervisorEmployeeId = await resolveEmployeeIdByRole({
    agentBaseUrl,
    roleId: "retry-supervisor",
    teamId: "team_infra",
    runtimeStatus: "implemented",
  });

  // Seed a deterministic operator_action_failed entry so the manager is
  // guaranteed to emit at least one decision, enabling all provenance checks.
  let seeded: SeedEnvelope;
  try {
    seeded = await seedWorkLog(agentBaseUrl, {
      employeeId: timeoutRecoveryEmployeeId,
      result: "operator_action_failed",
      count: 1,
    });
  } catch (err) {
    if (handleOperatorAgentSoftSkip("paperclip-first-execution-check", err)) {
      process.exit(0);
    }
    // Check for the structured errors thrown by seedWorkLog
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.startsWith("[not-deployed]")) {
        console.warn(
          `[warn] paperclip-first-execution-check: ${msg}; soft-skipping check`
        );
        process.exit(0);
      }
      if (msg.startsWith("[rate-limited]")) {
        console.warn(
          `[warn] paperclip-first-execution-check: ${msg}; soft-skipping check — write/test path appears rate-limited or quota-limited; read surface may still be healthy`
        );
        process.exit(0);
      }
      if (msg.startsWith("[cloudflare-edge-error]")) {
        console.warn(
          `[warn] paperclip-first-execution-check: ${msg}; soft-skipping check`
        );
        process.exit(0);
      }
    }
    throw err;
  }

  if (!seeded.ok || (seeded.seeded ?? 0) < 1) {
    throw new Error(
      `Work-log seed step failed: ${String(
        seeded.error ?? seeded.raw ?? summarizeForError(seeded)
      )}`
    );
  }

  const companyId = "company_internal_aep";

  const managerTaskId = await createTask(agentBaseUrl, {
    companyId,
    originatingTeamId: "team_infra",
    assignedTeamId: "team_infra",
    createdByEmployeeId: managerEmployeeId,
    assignedEmployeeId: managerEmployeeId,
    taskType: "paperclip-manager-check",
    title: "paperclip first execution manager check",
    payload: {
      scenario: "paperclip-first-execution-check",
      phase: "manager",
    },
  });

  const validBody = {
    teamId: "team_infra",
    employeeId: managerEmployeeId,
    roleId: "infra-ops-manager",
    trigger: "paperclip",
    policyVersion: "commit10-stageD",
    companyId,
    taskId: managerTaskId,
    heartbeatId: `hb-${Date.now()}`,
    targetEmployeeIdsOverride: [
      timeoutRecoveryEmployeeId,
      retrySupervisorEmployeeId,
    ],
  };

  const validPaperclip = await postRunUntilStatus({
    agentBaseUrl,
    body: validBody,
    headers: { "x-aep-execution-source": "paperclip" },
    expectedStatus: 200,
    label: "paperclip manager run",
  });

  const validPayload = validPaperclip.json as RunEnvelope;
  if (validPayload.executionContext?.executionSource !== "paperclip") {
    throw new Error("Expected executionContext.executionSource=paperclip");
  }
  if (validPayload.executionContext?.companyId !== companyId) {
    throw new Error(`Expected executionContext.companyId=${companyId}`);
  }

  const managerSignals = managerSignalsFromRun(validPayload);

  if (managerSignals.decisionsEmitted < 1) {
    throw new Error(
      `Expected decisionsEmitted >= 1 from seeded manager run, got ${managerSignals.decisionsEmitted}`
    );
  }

  const managerLog = await waitForJsonMatch<ManagerLogEnvelope>({
    label: "paperclip manager-log provenance",
    url: `${agentBaseUrl}/agent/manager-log?managerEmployeeId=${managerEmployeeId}&limit=100`,
    matches: (json): json is ManagerLogEnvelope => {
      const envelope = json as ManagerLogEnvelope;
      return (envelope.entries ?? []).some(
        (decision) =>
          decision.executionContext?.executionSource === "paperclip" &&
          decision.executionContext?.companyId === companyId
      );
    },
  });

  const paperclipDecision = (managerLog.entries ?? []).find(
    (decision) =>
      decision.executionContext?.executionSource === "paperclip" &&
      decision.executionContext?.companyId === companyId
  );

  if (!paperclipDecision) {
    throw new Error(
      "Expected at least one manager-log entry with paperclip execution provenance"
    );
  }

  const paperclipManagerLogProvenanceVerified = true;

  const escalations = await waitForJsonMatch<EscalationsEnvelope>({
    label: "paperclip escalation provenance",
    url: `${agentBaseUrl}/agent/escalations?limit=100`,
    matches: (json): json is EscalationsEnvelope => {
      const envelope = json as EscalationsEnvelope;
      return (envelope.entries ?? []).some(
        (entry) =>
          entry.executionContext?.executionSource === "paperclip" &&
          entry.executionContext?.companyId === companyId
      );
    },
  });

  const paperclipEscalation = (escalations.entries ?? []).find(
    (entry) =>
      entry.executionContext?.executionSource === "paperclip" &&
      entry.executionContext?.companyId === companyId
  );

  if (!paperclipEscalation) {
    throw new Error(
      "Expected at least one escalation entry with paperclip execution provenance"
    );
  }

  if (paperclipEscalation.companyId !== companyId) {
    throw new Error(
      `Expected escalation.companyId=${companyId}, got ${String(paperclipEscalation.companyId)}`
    );
  }

  const paperclipEscalationProvenanceVerified = true;

  const workerTaskId = await createTask(agentBaseUrl, {
    companyId,
    originatingTeamId: "team_infra",
    assignedTeamId: "team_infra",
    createdByEmployeeId: managerEmployeeId,
    assignedEmployeeId: timeoutRecoveryEmployeeId,
    taskType: "paperclip-worker-check",
    title: "paperclip first execution worker check",
    payload: {
      scenario: "paperclip-first-execution-check",
      phase: "worker",
      targetEmployeeId: timeoutRecoveryEmployeeId,
    },
  });

  if (!workerTaskId) {
    throw new Error("Expected worker task creation to return a taskId");
  }

  const workerPaperclip = await postRunUntilStatus({
    agentBaseUrl,
    body: {
      teamId: "team_infra",
      employeeId: timeoutRecoveryEmployeeId,
      roleId: "timeout-recovery-operator",
      trigger: "paperclip",
      policyVersion: "commit10-stageD",
      companyId,
      taskId: workerTaskId,
      heartbeatId: `hb-worker-${Date.now()}`,
    },
    headers: {
      "x-aep-execution-source": "paperclip",
    },
    expectedStatus: 200,
    label: "worker paperclip run",
  });

  if (workerPaperclip.status !== 200) {
    throw new Error(
      `Expected worker paperclip request to return 200, got ${workerPaperclip.status}`
    );
  }

  const workLog = await waitForJsonMatch<WorkLogEnvelope>({
    label: "paperclip worker work-log provenance",
    url: `${agentBaseUrl}/agent/work-log?employeeId=${timeoutRecoveryEmployeeId}&limit=100`,
    matches: (json): json is WorkLogEnvelope => {
      const envelope = json as WorkLogEnvelope;
      return (envelope.entries ?? []).some(
        (entry) =>
          entry.executionContext?.executionSource === "paperclip" &&
          entry.executionContext?.companyId === companyId
      );
    },
  });

  const paperclipWorkEntry = (workLog.entries ?? []).find(
    (entry) =>
      entry.executionContext?.executionSource === "paperclip" &&
      entry.executionContext?.companyId === companyId
  );

  if (!paperclipWorkEntry) {
    throw new Error(
      "Expected at least one work-log entry with paperclip execution provenance"
    );
  }

  const workerWorkLogProvenanceVerified = true;

  const missingMetadata = await postRun(
    agentBaseUrl,
    {
      ...validBody,
      heartbeatId: undefined,
    },
    {
      "x-aep-execution-source": "paperclip",
    }
  );

  if (missingMetadata.status !== 400) {
    throw new Error(
      `Expected missing paperclip metadata to return 400, got ${missingMetadata.status}`
    );
  }

  const missingSource = await postRun(
    agentBaseUrl,
    {
      teamId: "team_infra",
      employeeId: managerEmployeeId,
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: "commit10-stageD",
      targetEmployeeIdsOverride: [
        timeoutRecoveryEmployeeId,
        retrySupervisorEmployeeId,
      ],
    },
    {}
  );

  if (missingSource.status !== 400) {
    throw new Error(
      `Expected missing execution source to return 400, got ${missingSource.status}`
    );
  }

  const operatorRun = await postRun(
    agentBaseUrl,
    {
      teamId: "team_infra",
      employeeId: managerEmployeeId,
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: "commit10-stageD",
      targetEmployeeIdsOverride: [
        timeoutRecoveryEmployeeId,
        retrySupervisorEmployeeId,
      ],
    },
    {
      "x-aep-execution-source": "operator",
      "x-actor": "ci-paperclip-first-execution-check",
    }
  );

  if (operatorRun.status !== 200) {
    throw new Error(`Expected operator source to return 200, got ${operatorRun.status}`);
  }

  const operatorPayload = operatorRun.json as RunEnvelope;
  if (operatorPayload.executionContext?.executionSource !== "operator") {
    throw new Error("Expected executionContext.executionSource=operator");
  }

  const schedulerStatusResponse = await fetch(`${agentBaseUrl}/agent/scheduler-status`);
  const schedulerStatus = (await readJson(schedulerStatusResponse)) as {
    primaryScheduler?: string;
    cronFallbackEnabled?: boolean;
    cadence?: {
      managerTickIntervalMinutes?: number;
    };
  };

  if (schedulerStatusResponse.status !== 200) {
    throw new Error(
      `Expected /agent/scheduler-status to return 200, got ${schedulerStatusResponse.status}`
    );
  }

  if (schedulerStatus.primaryScheduler !== "paperclip") {
    throw new Error(
      `Expected primaryScheduler=paperclip, got ${String(schedulerStatus.primaryScheduler)}`
    );
  }

  const managerTickIntervalMinutes = Number(
    schedulerStatus.cadence?.managerTickIntervalMinutes ?? 1,
  );
  const alignedScheduledTimeMs = alignScheduledTimeForMinuteInterval(
    managerTickIntervalMinutes,
  );

  // Trigger the worker cron and rely on interval gating to drive any nested loops.
  // The seeded work-log entry ensures the cron run also emits a decision.
  const scheduledResult = await triggerScheduled(
    agentBaseUrl,
    WORKER_CRON,
    alignedScheduledTimeMs,
  );

  if (scheduledResult.status !== 200) {
    throw new Error(
      `Expected /__scheduled to return 200, got ${scheduledResult.status} — start the agent with --test-scheduled`
    );
  }

  const refreshedManagerLog = await waitForJsonMatch<ManagerLogEnvelope>({
    label: "cron fallback manager-log provenance",
    url: `${agentBaseUrl}/agent/manager-log?managerEmployeeId=${managerEmployeeId}&limit=100`,
    matches: (json): json is ManagerLogEnvelope => {
      const envelope = json as ManagerLogEnvelope;
      return (envelope.entries ?? []).some(
        (decision) => decision.executionContext?.executionSource === "cron_fallback"
      );
    },
  });

  const cronFallbackDecision = (refreshedManagerLog.entries ?? []).find(
    (decision) => decision.executionContext?.executionSource === "cron_fallback"
  );

  if (!cronFallbackDecision) {
    throw new Error(
      "Expected at least one manager-log entry with cron_fallback execution provenance"
    );
  }

  const cronFallbackManagerLogProvenanceVerified = true;

  const expectAuthRequired = process.env.EXPECT_PAPERCLIP_AUTH_REQUIRED === "true";
  const configuredSecret = process.env.PAPERCLIP_SHARED_SECRET;

  if (expectAuthRequired) {
    const missingSecret = await postRun(agentBaseUrl, validBody, {
      "x-aep-execution-source": "paperclip",
    });

    if (missingSecret.status !== 400) {
      throw new Error(
        `Expected missing paperclip shared secret to return 400 when auth required, got ${missingSecret.status}`
      );
    }

    if (!configuredSecret) {
      throw new Error(
        "EXPECT_PAPERCLIP_AUTH_REQUIRED=true but PAPERCLIP_SHARED_SECRET is not set in CI environment"
      );
    }

    const validSecret = await postRun(agentBaseUrl, validBody, {
      "x-aep-execution-source": "paperclip",
      "x-paperclip-shared-secret": configuredSecret,
    });

    if (validSecret.status !== 200) {
      throw new Error(
        `Expected authenticated paperclip request to return 200, got ${validSecret.status}`
      );
    }
  }

  console.log("paperclip-first-execution-check passed", {
    primaryScheduler: schedulerStatus.primaryScheduler,
    cronFallbackEnabled: schedulerStatus.cronFallbackEnabled,
    seededWorkLogEntries: seeded.seeded,
    paperclipAccepted: validPaperclip.status,
    managerDecisionsEmitted: managerSignals.decisionsEmitted,
    managerEscalationsCreated: managerSignals.escalationsCreated,
    paperclipManagerLogProvenanceVerified,
    paperclipEscalationProvenanceVerified,
    workerWorkLogProvenanceVerified,
    cronFallbackManagerLogProvenanceVerified,
    paperclipMissingMetadataRejected: missingMetadata.status,
    missingSourceRejected: missingSource.status,
    operatorAccepted: operatorRun.status,
    authRequiredTested: expectAuthRequired,
  });
}

main().catch((error) => {
  console.error("paperclip-first-execution-check failed");
  console.error(error);
  process.exit(1);
});
