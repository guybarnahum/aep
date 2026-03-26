/* eslint-disable no-console */

import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

const POLICY_VERSION = "commit10-stageD";

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
  decisions: ManagerDecision[];
  message: string;
  controlPlaneBaseUrl: string;
};

type EscalationsResponse = {
  ok: true;
  count: number;
  entries: Array<{
    escalationId: string;
    timestamp: string;
    severity: string;
    state: string;
    reason: string;
    affectedEmployeeIds: string[];
    message: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    resolutionNote?: string;
  }>;
};

type ControlHistoryResponse = {
  ok: true;
  count: number;
  entries: Array<{
    historyId: string;
    timestamp: string;
    employeeId: string;
    previousState?: {
      state: string;
      blocked: boolean;
    };
    nextState?: {
      state: string;
      blocked: boolean;
    };
    transition: string;
    reason: string;
  }>;
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

async function runManager(
  agentBaseUrl: string,
  observedEmployeeIds: string[]
): Promise<ManagerRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "ci-escalation-audit-check",
    },
    body: JSON.stringify({
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdsOverride: observedEmployeeIds,
    }),
  });

  return readJson<ManagerRunResponse>(response);
}

async function getEscalations(agentBaseUrl: string): Promise<EscalationsResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/escalations?limit=100`);
  return readJson<EscalationsResponse>(response);
}

async function getControlHistory(agentBaseUrl: string): Promise<ControlHistoryResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/control-history?limit=100`);
  return readJson<ControlHistoryResponse>(response);
}

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const observedEmployeeIds = (
    process.env.OPERATOR_AGENT_MANAGER_OBSERVED_EMPLOYEE_IDS ??
    "emp_timeout_recovery_01,emp_retry_supervisor_01"
  ).split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  const managerRun = await runManager(agentBaseUrl, observedEmployeeIds);

  if (managerRun.policyVersion !== POLICY_VERSION) {
    throw new Error(
      `Unexpected manager policyVersion: ${managerRun.policyVersion}`
    );
  }

  if (managerRun.employee.employeeId !== "emp_infra_ops_manager_01") {
    throw new Error(
      `Unexpected manager employeeId: ${managerRun.employee.employeeId}`
    );
  }

  const escalations = await getEscalations(agentBaseUrl);
  if (!escalations.ok) {
    throw new Error("/agent/escalations did not return ok=true");
  }

  if (escalations.count < managerRun.summary.escalationsCreated) {
    throw new Error(
      `Expected at least ${managerRun.summary.escalationsCreated} escalations in store, got ${escalations.count}`
    );
  }

  const controlHistory = await getControlHistory(agentBaseUrl);
  if (!controlHistory.ok) {
    throw new Error("/agent/control-history did not return ok=true");
  }

  if (controlHistory.count === 0 && managerRun.summary.restrictionDecisions > 0) {
    throw new Error(
      "Expected control history records when restriction decisions were made"
    );
  }

  for (const escalation of escalations.entries) {
    if (!escalation.escalationId) {
      throw new Error("Escalation missing escalationId");
    }

    if (!escalation.timestamp) {
      throw new Error("Escalation missing timestamp");
    }

    if (!escalation.severity) {
      throw new Error("Escalation missing severity");
    }

    if (!escalation.state) {
      throw new Error("Escalation missing state");
    }

    if (!Array.isArray(escalation.affectedEmployeeIds)) {
      throw new Error("Escalation missing affectedEmployeeIds array");
    }
  }

  for (const entry of controlHistory.entries) {
    if (!entry.historyId) {
      throw new Error("Control history entry missing historyId");
    }

    if (!entry.timestamp) {
      throw new Error("Control history entry missing timestamp");
    }

    if (!entry.employeeId) {
      throw new Error("Control history entry missing employeeId");
    }

    if (!entry.transition) {
      throw new Error("Control history entry missing transition");
    }
  }

  console.log("escalation-audit-check passed", {
    observedEmployeeIds,
    decisionsEmitted: managerRun.summary.decisionsEmitted,
    escalationsCreated: managerRun.summary.escalationsCreated,
    escalationsInAuditLog: escalations.count,
    controlStateTransitions: controlHistory.count,
    restrictionDecisions: managerRun.summary.restrictionDecisions,
  });
}

main().catch((error) => {
  console.error("escalation-audit-check failed");
  console.error(error);
  process.exit(1);
});
