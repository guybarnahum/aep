/* eslint-disable no-console */

export {};

const POLICY_VERSION = "commit10-stageD";

type PaperclipRunResponse = {
  ok: true;
  status: "completed";
  executionSource: "paperclip";
  cronFallbackRecommended: boolean;
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
    decisionsEmitted: number;
  };
  perEmployee: unknown[];
  decisions: unknown[];
  message: string;
  controlPlaneBaseUrl: string;
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
  const agentBaseUrl = requireEnv("OPERATOR_AGENT_BASE_URL");

  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      departmentId: "aep-infra-ops",
      employeeId: "emp_timeout_recovery_01",
      roleId: "timeout-recovery-operator",
      trigger: "paperclip",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdOverride: "emp_timeout_recovery_01",
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

  if (result.cronFallbackRecommended !== false) {
    throw new Error(
      `Expected cronFallbackRecommended=false, got ${result.cronFallbackRecommended}`
    );
  }

  if (result.policyVersion !== POLICY_VERSION) {
    throw new Error(`Expected policyVersion="${POLICY_VERSION}", got "${result.policyVersion}"`);
  }

  if (result.trigger !== "paperclip") {
    throw new Error(`Expected trigger="paperclip", got "${result.trigger}"`);
  }

  if (result.employee.employeeId !== "emp_timeout_recovery_01") {
    throw new Error(
      `Expected executionSource from emp_timeout_recovery_01, got ${result.employee.employeeId}`
    );
  }

  console.log("paperclip-company-handoff-check passed", {
    executionSource: result.executionSource,
    cronFallbackRecommended: result.cronFallbackRecommended,
    policyVersion: result.policyVersion,
    trigger: result.trigger,
    employeeId: result.employee.employeeId,
    decisionsEmitted: result.summary.decisionsEmitted,
    escalationsCreated: result.summary.escalationsCreated,
  });
}

main().catch((error) => {
  console.error("paperclip-company-handoff-check failed");
  console.error(error);
  process.exit(1);
});
