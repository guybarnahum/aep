/* eslint-disable no-console */

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
};

const MANAGER_CRON = "*/5 * * * *";

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

async function seedWorkLog(
  agentBaseUrl: string,
  body: Record<string, unknown>
): Promise<SeedEnvelope> {
  const response = await fetch(`${agentBaseUrl}/agent/te/seed-work-log`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 404) {
    throw new Error(
      "Seed endpoint returned 404 — start the operator-agent with --var ENABLE_TEST_ENDPOINTS:true"
    );
  }

  return (await readJson(response)) as SeedEnvelope;
}

async function triggerScheduled(
  agentBaseUrl: string,
  cron: string
): Promise<{ status: number }> {
  const url = `${agentBaseUrl}/__scheduled?cron=${encodeURIComponent(cron)}`;
  const response = await fetch(url, { method: "POST" });
  return { status: response.status };
}

async function main(): Promise<void> {
  const agentBaseUrl = requireEnv("OPERATOR_AGENT_BASE_URL");

  // Seed a deterministic operator_action_failed entry so the manager is
  // guaranteed to emit at least one decision, enabling all provenance checks.
  const seeded = await seedWorkLog(agentBaseUrl, {
    employeeId: "emp_timeout_recovery_01",
    result: "operator_action_failed",
    count: 1,
  });

  if (!seeded.ok || (seeded.seeded ?? 0) < 1) {
    throw new Error(`Work-log seed step failed: ${String(seeded.error ?? "unknown")}`);
  }

  const validBody = {
    departmentId: "aep-infra-ops",
    employeeId: "emp_infra_ops_manager_01",
    roleId: "infra-ops-manager",
    trigger: "paperclip",
    policyVersion: "commit10-stageD",
    companyId: "company-1",
    taskId: `task-${Date.now()}`,
    heartbeatId: `hb-${Date.now()}`,
    targetEmployeeIdsOverride: [
      "emp_timeout_recovery_01",
      "emp_retry_supervisor_01",
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
  if (validPayload.executionContext?.companyId !== "company-1") {
    throw new Error("Expected executionContext.companyId=company-1");
  }

  const managerSignals = managerSignalsFromRun(validPayload);

  if (managerSignals.decisionsEmitted < 1) {
    throw new Error(
      `Expected decisionsEmitted >= 1 from seeded manager run, got ${managerSignals.decisionsEmitted}`
    );
  }

  const managerLog = await waitForJsonMatch<ManagerLogEnvelope>({
    label: "paperclip manager-log provenance",
    url: `${agentBaseUrl}/agent/manager-log?managerEmployeeId=emp_infra_ops_manager_01&limit=100`,
    matches: (json): json is ManagerLogEnvelope => {
      const envelope = json as ManagerLogEnvelope;
      return (envelope.entries ?? []).some(
        (decision) =>
          decision.executionContext?.executionSource === "paperclip" &&
          decision.executionContext?.companyId === "company-1"
      );
    },
  });

  const paperclipDecision = (managerLog.entries ?? []).find(
    (decision) =>
      decision.executionContext?.executionSource === "paperclip" &&
      decision.executionContext?.companyId === "company-1"
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
          entry.executionContext?.companyId === "company-1"
      );
    },
  });

  const paperclipEscalation = (escalations.entries ?? []).find(
    (entry) =>
      entry.executionContext?.executionSource === "paperclip" &&
      entry.executionContext?.companyId === "company-1"
  );

  if (!paperclipEscalation) {
    throw new Error(
      "Expected at least one escalation entry with paperclip execution provenance"
    );
  }

  if (paperclipEscalation.companyId !== "company-1") {
    throw new Error(
      `Expected escalation.companyId=company-1, got ${String(paperclipEscalation.companyId)}`
    );
  }

  const paperclipEscalationProvenanceVerified = true;

  const workerPaperclip = await postRunUntilStatus({
    agentBaseUrl,
    body: {
      departmentId: "aep-infra-ops",
      employeeId: "emp_timeout_recovery_01",
      roleId: "timeout-recovery-operator",
      trigger: "paperclip",
      policyVersion: "commit10-stageD",
      companyId: "company-1",
      taskId: `task-worker-${Date.now()}`,
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
    url: `${agentBaseUrl}/agent/work-log?employeeId=emp_timeout_recovery_01&limit=100`,
    matches: (json): json is WorkLogEnvelope => {
      const envelope = json as WorkLogEnvelope;
      return (envelope.entries ?? []).some(
        (entry) =>
          entry.executionContext?.executionSource === "paperclip" &&
          entry.executionContext?.companyId === "company-1"
      );
    },
  });

  const paperclipWorkEntry = (workLog.entries ?? []).find(
    (entry) =>
      entry.executionContext?.executionSource === "paperclip" &&
      entry.executionContext?.companyId === "company-1"
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
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: "commit10-stageD",
      targetEmployeeIdsOverride: [
        "emp_timeout_recovery_01",
        "emp_retry_supervisor_01",
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
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: "commit10-stageD",
      targetEmployeeIdsOverride: [
        "emp_timeout_recovery_01",
        "emp_retry_supervisor_01",
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

  // Trigger the manager cron to generate a cron_fallback provenance entry.
  // The seeded work-log entry ensures the cron run also emits a decision.
  const scheduledResult = await triggerScheduled(agentBaseUrl, MANAGER_CRON);

  if (scheduledResult.status !== 200) {
    throw new Error(
      `Expected /__scheduled to return 200, got ${scheduledResult.status} — start the agent with --test-scheduled`
    );
  }

  const refreshedManagerLog = await waitForJsonMatch<ManagerLogEnvelope>({
    label: "cron fallback manager-log provenance",
    url: `${agentBaseUrl}/agent/manager-log?managerEmployeeId=emp_infra_ops_manager_01&limit=100`,
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
