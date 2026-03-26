/* eslint-disable no-console */

import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

const POLICY_VERSION = "commit10-stageB";

type EmployeesResponse = {
  ok: true;
  count: number;
  employees: Array<{
    identity: {
      employeeId: string;
    };
    budget: {
      maxActionsPerScan: number;
    };
    effectiveBudget: {
      maxActionsPerScan: number;
    };
    effectiveState: {
      state:
        | "enabled"
        | "disabled_pending_review"
        | "disabled_by_manager"
        | "restricted";
      blocked: boolean;
    };
  }>;
};

type EmployeeControlsResponse = {
  ok: true;
  employeeId: string;
  control: {
    state:
      | "enabled"
      | "disabled_pending_review"
      | "disabled_by_manager"
      | "restricted";
    transition:
      | "disabled"
      | "re_enabled"
      | "restricted"
      | "restrictions_cleared";
    budgetOverride?: {
      maxActionsPerScan?: number;
    };
    authorityOverride?: {
      allowedTenants?: string[];
      allowedServices?: string[];
      requireTraceVerification?: boolean;
    };
  } | null;
  effectiveState: {
    state:
      | "enabled"
      | "disabled_pending_review"
      | "disabled_by_manager"
      | "restricted";
    blocked: boolean;
  };
};

type ManagerRunResponse = {
  ok: true;
  status: "completed";
  policyVersion: string;
  summary: {
    repeatedVerificationFailures: number;
    operatorActionFailures: number;
    budgetExhaustionSignals: number;
    reEnableDecisions: number;
    restrictionDecisions: number;
    clearedRestrictionDecisions: number;
    decisionsEmitted: number;
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

async function runManager(
  agentBaseUrl: string,
  observedEmployeeId: string
): Promise<ManagerRunResponse> {
  return readJson<ManagerRunResponse>(
    await fetch(`${agentBaseUrl}/agent/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aep-execution-source": "operator",
        "x-actor": "ci-manager-policy-overlay-check",
      },
      body: JSON.stringify({
        departmentId: "aep-infra-ops",
        employeeId: "emp_infra_ops_manager_01",
        roleId: "infra-ops-manager",
        trigger: "manual",
        policyVersion: POLICY_VERSION,
        targetEmployeeIdOverride: observedEmployeeId,
      }),
    })
  );
}

async function getEmployees(agentBaseUrl: string): Promise<EmployeesResponse> {
  return readJson<EmployeesResponse>(
    await fetch(`${agentBaseUrl}/agent/employees`)
  );
}

async function getEmployeeControls(
  agentBaseUrl: string,
  employeeId: string
): Promise<EmployeeControlsResponse> {
  return readJson<EmployeeControlsResponse>(
    await fetch(
      `${agentBaseUrl}/agent/employee-controls?employeeId=${encodeURIComponent(
        employeeId
      )}`
    )
  );
}

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const observedEmployeeId =
    process.env.OPERATOR_AGENT_MANAGER_OBSERVED_EMPLOYEE_ID ??
    "emp_timeout_recovery_01";

  const managerRun = await runManager(agentBaseUrl, observedEmployeeId);

  if (managerRun.policyVersion !== POLICY_VERSION) {
    throw new Error(
      `Unexpected policyVersion from manager run: ${managerRun.policyVersion}`
    );
  }

  const controls = await getEmployeeControls(agentBaseUrl, observedEmployeeId);
  const employees = await getEmployees(agentBaseUrl);
  const employee = employees.employees.find(
    (item) => item.identity.employeeId === observedEmployeeId
  );

  if (!employee) {
    throw new Error(`Observed employee missing from /agent/employees`);
  }

  if (controls.effectiveState.state === "restricted") {
    if (controls.effectiveState.blocked) {
      throw new Error("Restricted employee must remain runnable");
    }

    if (
      !controls.control?.budgetOverride &&
      !controls.control?.authorityOverride
    ) {
      throw new Error("Restricted control must include persisted overlays");
    }

    if (
      employee.effectiveBudget.maxActionsPerScan >
      employee.budget.maxActionsPerScan
    ) {
      throw new Error(
        "Effective restricted budget must not exceed base employee budget"
      );
    }
  }

  console.log("manager-policy-overlay-check passed", {
    observedEmployeeId,
    state: controls.effectiveState.state,
    blocked: controls.effectiveState.blocked,
    baseMaxActionsPerScan: employee.budget.maxActionsPerScan,
    effectiveMaxActionsPerScan: employee.effectiveBudget.maxActionsPerScan,
    restrictionDecisions: managerRun.summary.restrictionDecisions,
    clearedRestrictionDecisions:
      managerRun.summary.clearedRestrictionDecisions,
  });
}

main().catch((error) => {
  console.error("manager-policy-overlay-check failed");
  console.error(error);
  process.exit(1);
});
