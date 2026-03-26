/* eslint-disable no-console */

export {};

const POLICY_VERSION = "commit10-stageB";

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
    reEnableDecisions: number;
    restrictionDecisions: number;
    clearedRestrictionDecisions: number;
    decisionsEmitted: number;
  };
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
  observedEmployeeId: string
): Promise<ManagerRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdOverride: observedEmployeeId,
    }),
  });

  return readJson<ManagerRunResponse>(response);
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
  const agentBaseUrl = requireEnv("OPERATOR_AGENT_BASE_URL");
  const observedEmployeeId =
    process.env.OPERATOR_AGENT_MANAGER_OBSERVED_EMPLOYEE_ID ??
    "emp_timeout_recovery_01";

  const managerRun = await runManager(agentBaseUrl, observedEmployeeId);

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

  if (managerRun.observedEmployeeId !== observedEmployeeId) {
    throw new Error(
      `Unexpected observedEmployeeId: ${managerRun.observedEmployeeId}`
    );
  }

  const managerLog = await getManagerLog(agentBaseUrl);
  if (!managerLog.ok) {
    throw new Error("Manager log route did not return ok=true");
  }

  const employeeControls = await getEmployeeControls(
    agentBaseUrl,
    observedEmployeeId
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
    observedEmployeeId,
    state: employeeControls.control?.state ?? "enabled",
    decisionsEmitted: managerRun.summary.decisionsEmitted,
    restrictionDecisions: managerRun.summary.restrictionDecisions,
    managerLogCount: managerLog.count,
  });
}

main().catch((error) => {
  console.error("manager-advisory-check failed");
  console.error(error);
  process.exit(1);
});
