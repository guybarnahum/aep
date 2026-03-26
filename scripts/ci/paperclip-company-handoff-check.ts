/* eslint-disable no-console */

import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

const POLICY_VERSION = "commit10-stageD";

type PaperclipRunResponse = {
  ok: true;
  status: "completed";
  companyId: string;
  taskId: string;
  heartbeatId: string;
  request: {
    policyVersion: string;
    trigger: string;
    employeeId: string;
    roleId: string;
  };
  result: unknown;
  executionSource: "paperclip";
  cronFallbackRecommended: boolean;
  executionContext?: {
    executionSource: "paperclip";
    companyId: string;
    taskId: string;
    heartbeatId: string;
  };
  routing?: {
    employeeId: string | null;
    workerId: string | null;
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

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });

  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "paperclip",
    },
    body: JSON.stringify({
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "paperclip",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdsOverride: [
        "emp_timeout_recovery_01",
        "emp_retry_supervisor_01",
      ],
      companyId: "company-12345",
      heartbeatId: "hb-" + Date.now(),
      taskId: "task-" + Date.now(),
    }),
  });

  const result = await readJson<PaperclipRunResponse>(response);

  if (!result.ok) {
    throw new Error("Agent run did not return ok=true");
  }

  if (result.executionSource !== "paperclip") {
    throw new Error(
      `Expected executionSource="paperclip", got "${result.executionSource}"`
    );
  }

  if (result.executionContext?.executionSource !== "paperclip") {
    throw new Error("Expected executionContext.executionSource=paperclip");
  }

  if (result.executionContext?.companyId !== "company-12345") {
    throw new Error("Expected executionContext.companyId=company-12345");
  }

  if (result.cronFallbackRecommended !== false) {
    throw new Error(
      `Expected cronFallbackRecommended=false, got ${result.cronFallbackRecommended}`
    );
  }

  if (result.request.policyVersion !== POLICY_VERSION) {
    throw new Error(
      `Expected request.policyVersion="${POLICY_VERSION}", got "${result.request.policyVersion}"`
    );
  }

  if (result.request.trigger !== "paperclip") {
    throw new Error(
      `Expected request.trigger="paperclip", got "${result.request.trigger}"`
    );
  }

  if (result.request.employeeId !== "emp_infra_ops_manager_01") {
    throw new Error(
      `Expected employeeId=emp_infra_ops_manager_01, got ${result.request.employeeId}`
    );
  }

  console.log("paperclip-company-handoff-check passed", {
    executionSource: result.executionSource,
    cronFallbackRecommended: result.cronFallbackRecommended,
    policyVersion: result.request.policyVersion,
    trigger: result.request.trigger,
    employeeId: result.request.employeeId,
    routing: result.routing,
    hasExecutionContext: Boolean(result.executionContext),
  });
}

main().catch((error) => {
  console.error("paperclip-company-handoff-check failed");
  console.error(error);
  process.exit(1);
});
