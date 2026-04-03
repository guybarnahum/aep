/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

const POLICY_VERSION = "commit10-stageD";

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
    crossWorkerAlerts: number;      escalationsCreated: number;    decisionsEmitted: number;
  };
  perEmployee: Array<{
    employeeId: string;
    workLogEntries: number;
    verificationFailed: number;
    operatorActionFailed: number;
    budgetExhausted: number;
    reEnableDecisions: number;
    restrictionDecisions: number;
    clearedRestrictionDecisions: number;
  }>;
  decisions: ManagerDecision[];
  message: string;
  controlPlaneBaseUrl: string;
};

type ManagerLogResponse = {
  ok: true;
  managerEmployeeId: string;
  count: number;
  entries: ManagerDecision[];
};

type EscalationsResponse = {
  ok: true;
  count: number;
  escalations: unknown[];
};

type EmployeeControlsResponse = {
  ok: true;
  employeeId: string;
  control: {
    employeeId: string;
    state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
    transition: string;
    updatedByEmployeeId: string;
    updatedByRoleId: string;
    policyVersion: string;
    reason: string;
    message: string;
    budgetOverride?: Record<string, unknown>;
    authorityOverride?: Record<string, unknown>;
    evidence?: {
      windowEntryCount: number;
      resultCounts?: Record<string, number>;
    };
  } | null;
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
      "x-actor": "ci-manager-advisory-check",
    },
    body: JSON.stringify({
      teamId: "team_infra",
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
  const response = await fetch(`${agentBaseUrl}/agent/escalations?limit=50`);
  return readJson<EscalationsResponse>(response);
}

async function getManagerLog(agentBaseUrl: string): Promise<ManagerLogResponse> {
  const response = await fetch(
    `${agentBaseUrl}/agent/manager-log?managerEmployeeId=emp_infra_ops_manager_01&limit=20`
  );
  return readJson<ManagerLogResponse>(response);
}

async function getEmployeeControls(
  agentBaseUrl: string,
  employeeId: string
): Promise<EmployeeControlsResponse> {
  const response = await fetch(
    `${agentBaseUrl}/agent/employee-controls?employeeId=${encodeURIComponent(employeeId)}`
  );
  return readJson<EmployeeControlsResponse>(response);
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

  if (
    !Array.isArray(managerRun.observedEmployeeIds) ||
    managerRun.observedEmployeeIds.length === 0
  ) {
    throw new Error("Expected observedEmployeeIds to be a non-empty array");
  }

  if (managerRun.scanned.employeesObserved !== observedEmployeeIds.length) {
    throw new Error(
      `Expected employeesObserved=${observedEmployeeIds.length}, got ${managerRun.scanned.employeesObserved}`
    );
  }

  if (managerRun.perEmployee.length !== observedEmployeeIds.length) {
    throw new Error(
      `Expected perEmployee length=${observedEmployeeIds.length}, got ${managerRun.perEmployee.length}`
    );
  }

  const managerLog = await getManagerLog(agentBaseUrl);
  if (!managerLog.ok) {
    throw new Error("Manager log route did not return ok=true");
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

  const employeeControls = await getEmployeeControls(
    agentBaseUrl,
    observedEmployeeIds[0]
  );

  if (!employeeControls.ok) {
    throw new Error("Employee controls route did not return ok=true");
  }

  if (
    employeeControls.control?.state === "restricted" &&
    !employeeControls.control.budgetOverride &&
    !employeeControls.control.authorityOverride
  ) {
    throw new Error(
      "Restricted control must include at least one persisted overlay"
    );
  }

  console.log("manager-advisory-check passed", {
    observedEmployeeIds,
    employeesObserved: managerRun.scanned.employeesObserved,
    crossWorkerAlerts: managerRun.summary.crossWorkerAlerts,
    escalationsCreated: managerRun.summary.escalationsCreated,
    decisionsEmitted: managerRun.summary.decisionsEmitted,
    restrictionDecisions: managerRun.summary.restrictionDecisions,
    managerLogCount: managerLog.count,
    escalationsInStore: escalations.count,
  });
}

main().catch((error) => {
  if (handleOperatorAgentSoftSkip("manager-advisory-check", error)) {
    process.exit(0);
  }

  console.error("manager-advisory-check failed");
  console.error(error);
  process.exit(1);
});
