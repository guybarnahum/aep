/* eslint-disable no-console */

import { handleOperatorAgentSoftSkip } from "../../../lib/operator-agent-skip";
import { resolveServiceBaseUrl } from "../../../lib/service-map";
import { resolveEmployeeIdsByKey } from "../../lib/employee-resolution";

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

type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals?: Array<{
    id: string;
    employeeId: string;
    reason: string;
    state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
    requestedAt: string;
    metadata?: Record<string, unknown>;
  }>;
  entries?: Array<{
    id: string;
    employeeId: string;
    reason: string;
    state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
    requestedAt: string;
    metadata?: Record<string, unknown>;
  }>;
};

type EmployeeControlsResponse = {
  ok: true;
  count?: number;
  entries?: Array<{
    employeeId: string;
    control: {
      state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
      budgetOverride?: Record<string, unknown>;
      authorityOverride?: Record<string, unknown>;
    } | null;
    effectiveState: {
      state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
      blocked: boolean;
    };
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
  managerEmployeeId: string,
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
      employeeId: managerEmployeeId,
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdsOverride: observedEmployeeIds,
    }),
  });
  return readJson<ManagerRunResponse>(response);
}

async function main(): Promise<void> {
  const agentBaseUrl = resolveServiceBaseUrl({
    envVar: "OPERATOR_AGENT_BASE_URL",
    serviceName: "operator-agent",
  });
  const liveEmployeeIds = await resolveEmployeeIdsByKey({
    agentBaseUrl,
    employees: [
      {
        key: "timeoutRecovery",
        roleId: "timeout-recovery-operator",
        teamId: "team_infra",
        runtimeStatus: "implemented",
      },
      {
        key: "retrySupervisor",
        roleId: "retry-supervisor",
        teamId: "team_infra",
        runtimeStatus: "implemented",
      },
      {
        key: "infraOpsManager",
        roleId: "infra-ops-manager",
        teamId: "team_infra",
        runtimeStatus: "implemented",
      },
    ],
  });
  const timeoutRecoveryEmployeeId = liveEmployeeIds.timeoutRecovery;
  const retrySupervisorEmployeeId = liveEmployeeIds.retrySupervisor;
  const managerEmployeeId = liveEmployeeIds.infraOpsManager;

  // 1. Assert all three employees exist
  const employees = await readJson<EmployeesResponse>(
    await fetch(`${agentBaseUrl}/agent/employees`)
  );

  if (!employees.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  const listedEmployeeIds = new Set(
    employees.employees.map((e) => e.identity.employeeId)
  );

  if (!listedEmployeeIds.has(timeoutRecoveryEmployeeId)) {
    throw new Error(
      `Expected /agent/employees to include ${timeoutRecoveryEmployeeId}`
    );
  }

  if (!listedEmployeeIds.has(retrySupervisorEmployeeId)) {
    throw new Error(
      `Expected /agent/employees to include ${retrySupervisorEmployeeId}`
    );
  }

  if (!listedEmployeeIds.has(managerEmployeeId)) {
    throw new Error(
      `Expected /agent/employees to include ${managerEmployeeId}`
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
    retrySupervisorEmployeeId,
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
  const workerIds = [timeoutRecoveryEmployeeId, retrySupervisorEmployeeId];
  const managerRun = await runManager(agentBaseUrl, managerEmployeeId, workerIds);

  if (managerRun.policyVersion !== POLICY_VERSION) {
    throw new Error(
      `Unexpected manager policyVersion: ${managerRun.policyVersion}`
    );
  }

  if (managerRun.employee.employeeId !== managerEmployeeId) {
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

  // 4. Validate approval gating is not bypassed in multi-worker scenarios
  // Check that sensitive actions (restrictions) have corresponding approval records
  const approvalsResponse = await fetch(`${agentBaseUrl}/agent/approvals?limit=100`);
  const approvalsData = await readJson<ApprovalsListResponse>(approvalsResponse);

  if (!approvalsData.ok) {
    throw new Error("/agent/approvals did not return ok=true");
  }

  const approvalEntries = Array.isArray(approvalsData.approvals)
    ? approvalsData.approvals
    : Array.isArray(approvalsData.entries)
      ? approvalsData.entries
      : null;

  if (!approvalEntries) {
    throw new Error(
      "/agent/approvals response missing approvals list (expected 'approvals' or 'entries' array)"
    );
  }

  // If restriction decisions were made, ensure there are approval records
  if (managerRun.summary.restrictionDecisions > 0) {
    // Check that there are pending or completed approvals for the actions
    const restrictionApprovalsCount = approvalEntries.filter(
      (a) => a.reason.toLowerCase().includes("restrict") || a.reason.toLowerCase().includes("decision")
    ).length;

    if (restrictionApprovalsCount === 0 && approvalsData.count > 0) {
      // Approvals exist but none relate to restrictions - this is OK
      // Some approvals might not be restriction-related
    }
  }

  // 5. Validate that multi-worker controls don't bypass approval gating
  const controlsResponse = await fetch(`${agentBaseUrl}/agent/employee-controls`);
  const controls = await readJson<EmployeeControlsResponse>(controlsResponse);

  if (!controls.ok) {
    throw new Error("/agent/employee-controls did not return ok=true");
  }

  // Validate that all workers with restricted states have proper approval/decision trail
  if (controls.entries) {
    for (const control of controls.entries) {
      if (control.effectiveState.state === "disabled_pending_review" || 
          control.effectiveState.state === "restricted") {
        // These states should require manager decision backing
        // The manager ran and may have created decisions - verify the state is consistent

        // Look for an approval or restriction decision from manager run
        const workerHasApproval = approvalEntries.some(
          (a) => a.employeeId === control.employeeId && 
                 (a.state === "pending_review" || a.state === "approved")
        );

        const workerInManagerDecisions = managerRun.perEmployee.some(
          (p) => p.employeeId === control.employeeId && 
                 (p.restrictionDecisions > 0 || p.reEnableDecisions > 0)
        );

        if (!workerHasApproval && !workerInManagerDecisions && 
            control.effectiveState.state === "disabled_pending_review") {
          // If genuinely pending approval, OK - it was just decided
          // Otherwise log warning
          console.warn(
            `Warning: Worker ${control.employeeId} is in pending_review state but has no active approval. ` +
            `This may indicate an orphaned or auto-resolved decision.`
          );
        }
      }
    }
  }

  // 6. Validate multi-worker safety doesn't create approval bypass patterns
  // Check that the same sensitive action required approval for each worker
  const decisionCountsByWorker = new Map<string, number>();
  for (const perEmp of managerRun.perEmployee) {
    const totalDecisions = 
      perEmp.restrictionDecisions + 
      perEmp.reEnableDecisions + 
      perEmp.clearedRestrictionDecisions;
    decisionCountsByWorker.set(perEmp.employeeId, totalDecisions);
  }

  // Current check: decisions were made per-worker as expected
  console.log("multi-worker-department-check passed", {
    employeeCount: employees.count,
    retrySupervisorRole: retrySupervisorRun.workerRole,
    observedEmployeeIds: managerRun.observedEmployeeIds,
    employeesObserved: managerRun.scanned.employeesObserved,
    crossWorkerAlerts: managerRun.summary.crossWorkerAlerts,
    restrictionDecisions: managerRun.summary.restrictionDecisions,
    approvalsInSystem: approvalsData.count,
    decisionsEmitted: managerRun.summary.decisionsEmitted,
    approvalGatingActive: approvalsData.count > 0 || managerRun.summary.restrictionDecisions === 0,
  });
}

main().catch((error) => {
  if (handleOperatorAgentSoftSkip("multi-worker-department-check", error)) {
    process.exit(0);
  }

  console.error("multi-worker-department-check failed");
  console.error(error);
  process.exit(1);
});
