/* eslint-disable no-console */

export {};

const POLICY_VERSION = "commit10-stageC";

type EmployeesResponse = {
  ok: true;
  count: number;
  employees: Array<{
    identity: {
      employeeId: string;
      roleId: string;
      employeeName: string;
    };
    authority: Record<string, unknown>;
    budget: Record<string, unknown>;
  }>;
};

type EmployeeRunResponse = {
  ok: true;
  status: string;
  policyVersion: string;
  trigger: string;
  dryRun: boolean;
  workerRole: string;
  employee: {
    employeeId: string;
    roleId: string;
  };
  scanned: Record<string, unknown>;
  summary: Record<string, unknown>;
  message: string;
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
    decisionsEmitted: number;
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

async function runEmployee(
  agentBaseUrl: string,
  employeeId: string,
  departmentId: string,
  roleId: string
): Promise<EmployeeRunResponse> {
  const response = await fetch(`${agentBaseUrl}/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aep-execution-source": "operator",
      "x-actor": "ci-multi-worker-department-check",
    },
    body: JSON.stringify({
      departmentId,
      employeeId,
      roleId,
      trigger: "manual",
      policyVersion: POLICY_VERSION,
    }),
  });
  return readJson<EmployeeRunResponse>(response);
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
      "x-actor": "ci-multi-worker-department-check",
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

async function main(): Promise<void> {
  const agentBaseUrl = requireEnv("OPERATOR_AGENT_BASE_URL");

  // 1. Assert all three employees exist
  const employees = await readJson<EmployeesResponse>(
    await fetch(`${agentBaseUrl}/agent/employees`)
  );

  if (!employees.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  const employeeIds = new Set(
    employees.employees.map((e) => e.identity.employeeId)
  );

  if (!employeeIds.has("emp_timeout_recovery_01")) {
    throw new Error(
      "Expected /agent/employees to include emp_timeout_recovery_01"
    );
  }

  if (!employeeIds.has("emp_retry_supervisor_01")) {
    throw new Error(
      "Expected /agent/employees to include emp_retry_supervisor_01"
    );
  }

  if (!employeeIds.has("emp_infra_ops_manager_01")) {
    throw new Error(
      "Expected /agent/employees to include emp_infra_ops_manager_01"
    );
  }

  if (employees.count < 3) {
    throw new Error(
      `Expected at least 3 employees in the department, got ${employees.count}`
    );
  }

  // 2. Run the retry-supervisor worker and assert it returns workerRole
  const retrySupervisorRun = await runEmployee(
    agentBaseUrl,
    "emp_retry_supervisor_01",
    "aep-infra-ops",
    "retry-supervisor"
  );

  if (retrySupervisorRun.workerRole !== "retry-supervisor") {
    throw new Error(
      `Expected retry-supervisor workerRole, got ${retrySupervisorRun.workerRole}`
    );
  }

  if (retrySupervisorRun.policyVersion !== POLICY_VERSION) {
    throw new Error(
      `Unexpected retry-supervisor policyVersion: ${retrySupervisorRun.policyVersion}`
    );
  }

  // 3. Run the manager observing both workers and assert perEmployee summaries
  const workerIds = ["emp_timeout_recovery_01", "emp_retry_supervisor_01"];
  const managerRun = await runManager(agentBaseUrl, workerIds);

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
    managerRun.observedEmployeeIds.length !== workerIds.length
  ) {
    throw new Error(
      `Expected observedEmployeeIds to contain ${workerIds.length} entries`
    );
  }

  if (managerRun.scanned.employeesObserved !== workerIds.length) {
    throw new Error(
      `Expected employeesObserved=${workerIds.length}, got ${managerRun.scanned.employeesObserved}`
    );
  }

  if (managerRun.perEmployee.length !== workerIds.length) {
    throw new Error(
      `Expected perEmployee.length=${workerIds.length}, got ${managerRun.perEmployee.length}`
    );
  }

  const perEmployeeIds = new Set(
    managerRun.perEmployee.map((p) => p.employeeId)
  );
  for (const workerId of workerIds) {
    if (!perEmployeeIds.has(workerId)) {
      throw new Error(
        `Expected perEmployee to include summary for ${workerId}`
      );
    }
  }

  console.log("multi-worker-department-check passed", {
    employeeCount: employees.count,
    retrySupervisorRole: retrySupervisorRun.workerRole,
    observedEmployeeIds: managerRun.observedEmployeeIds,
    employeesObserved: managerRun.scanned.employeesObserved,
    crossWorkerAlerts: managerRun.summary.crossWorkerAlerts,
    decisionsEmitted: managerRun.summary.decisionsEmitted,
  });
}

main().catch((error) => {
  console.error("multi-worker-department-check failed");
  console.error(error);
  process.exit(1);
});
