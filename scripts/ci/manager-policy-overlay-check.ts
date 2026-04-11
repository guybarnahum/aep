/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

const POLICY_VERSION = "commit10-stageB";

type EmployeeControlState =
  | "enabled"
  | "disabled_pending_review"
  | "disabled_by_manager"
  | "restricted";

type EmployeesResponse = {
  ok: true;
  count: number;
  employees: Array<{
    identity: {
      employeeId: string;
    };
    runtime: {
      runtimeStatus: "implemented" | "planned" | "disabled";
      effectiveBudget?: {
        maxActionsPerScan?: number;
        [key: string]: unknown;
      };
      effectiveState?: {
        state: EmployeeControlState;
        blocked: boolean;
      };
    };
  }>;
};

type EmployeeControlsResponse = {
  ok: true;
  employeeId: string;
  control: {
    state: EmployeeControlState;
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
  effectiveState?: {
    state: EmployeeControlState;
    blocked: boolean;
  };
};

type EmployeeEffectivePolicyResponse = {
  ok: true;
  employeeId: string;
  implemented: boolean;
  baseBudget?: {
    maxActionsPerScan?: number;
    [key: string]: unknown;
  };
  effectiveBudget?: {
    maxActionsPerScan?: number;
    [key: string]: unknown;
  };
  controlState?: {
    state: EmployeeControlState;
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

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${response.status} ${body}`);
  }
  return (await response.json()) as T;
}

async function runManager(
  agentBaseUrl: string,
  observedEmployeeId: string,
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
    }),
  );
}

async function getEmployees(agentBaseUrl: string): Promise<EmployeesResponse> {
  return readJson<EmployeesResponse>(
    await fetch(`${agentBaseUrl}/agent/employees`),
  );
}

async function getEmployeeControls(
  agentBaseUrl: string,
  employeeId: string,
): Promise<EmployeeControlsResponse> {
  return readJson<EmployeeControlsResponse>(
    await fetch(
      `${agentBaseUrl}/agent/employee-controls?employeeId=${encodeURIComponent(
        employeeId,
      )}`,
    ),
  );
}

async function getEmployeeEffectivePolicy(
  agentBaseUrl: string,
  employeeId: string,
): Promise<EmployeeEffectivePolicyResponse> {
  return readJson<EmployeeEffectivePolicyResponse>(
    await fetch(
      `${agentBaseUrl}/agent/employees/${encodeURIComponent(employeeId)}/effective-policy`,
    ),
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
      `Unexpected policyVersion from manager run: ${managerRun.policyVersion}`,
    );
  }

  const controls = await getEmployeeControls(agentBaseUrl, observedEmployeeId);
  const effectiveState = controls.effectiveState ?? {
    state: "enabled" as const,
    blocked: false,
  };
  const employees = await getEmployees(agentBaseUrl);
  const employee = employees.employees.find(
    (item) => item.identity.employeeId === observedEmployeeId,
  );

  if (!employee) {
    throw new Error("Observed employee missing from /agent/employees");
  }

  const effectivePolicy = await getEmployeeEffectivePolicy(
    agentBaseUrl,
    observedEmployeeId,
  );

  if (!effectivePolicy.ok) {
    throw new Error(
      `Expected /effective-policy to return ok=true for ${observedEmployeeId}`,
    );
  }

  if (!effectivePolicy.implemented) {
    throw new Error(
      `Expected observed employee ${observedEmployeeId} to be implemented, got ${JSON.stringify(
        effectivePolicy,
      )}`,
    );
  }

  if (employee.runtime.runtimeStatus !== "implemented") {
    throw new Error(
      `Expected observed employee ${observedEmployeeId} runtimeStatus=implemented, got ${employee.runtime.runtimeStatus}`,
    );
  }

  if (controls.control === null && effectiveState.state !== "enabled") {
    throw new Error(
      `Expected missing control to imply enabled effective state, got ${effectiveState.state}`,
    );
  }

  if (effectiveState.state === "restricted") {
    if (effectiveState.blocked) {
      throw new Error("Restricted employee must remain runnable");
    }

    if (
      !controls.control?.budgetOverride &&
      !controls.control?.authorityOverride
    ) {
      throw new Error("Restricted control must include persisted overlays");
    }

    const effectiveMaxActions =
      effectivePolicy.effectiveBudget?.maxActionsPerScan;
    const baseMaxActions = effectivePolicy.baseBudget?.maxActionsPerScan;

    if (
      typeof effectiveMaxActions === "number" &&
      typeof baseMaxActions === "number" &&
      effectiveMaxActions > baseMaxActions
    ) {
      throw new Error(
        "Effective restricted budget must not exceed base employee budget",
      );
    }
  }

  console.log("manager-policy-overlay-check passed", {
    observedEmployeeId,
    state: effectiveState.state,
    blocked: effectiveState.blocked,
    baseMaxActionsPerScan:
      effectivePolicy.baseBudget?.maxActionsPerScan ?? null,
    effectiveMaxActionsPerScan:
      effectivePolicy.effectiveBudget?.maxActionsPerScan ?? null,
    restrictionDecisions: managerRun.summary.restrictionDecisions,
    clearedRestrictionDecisions:
      managerRun.summary.clearedRestrictionDecisions,
  });
}

main().catch((error) => {
  if (handleOperatorAgentSoftSkip("manager-policy-overlay-check", error)) {
    process.exit(0);
  }

  console.error("manager-policy-overlay-check failed");
  console.error(error);
  process.exit(1);
});
