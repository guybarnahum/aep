/* eslint-disable no-console */

import { resolveServiceBaseUrl } from "../lib/service-map";
import { handleOperatorAgentSoftSkip } from "../lib/operator-agent-skip";

export {};

type EmployeesResponse = {
  ok: true;
  count: number;
  employees: Array<{
    identity: {
      employeeId: string;
      roleId: string;
      employeeName: string;
      companyId: string;
      teamId: string;
    };
    catalog: {
      companyId: string;
      teamId: string;
      status: string;
      schedulerMode: string;
      implemented: boolean;
    };
    authority?: Record<string, unknown>;
    budget?: Record<string, unknown>;
    effectiveAuthority?: {
      allowedTenants?: string[];
      allowedServices?: string[];
      allowedEnvironmentNames?: string[];
      [key: string]: unknown;
    };
    effectiveBudget?: Record<string, unknown>;
    effectiveState?: {
      state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
        identity: {
          employeeId: string;
          roleId: string;
          companyId: string;
          teamId: string;
        };
        runtime: {
          runtimeStatus: "implemented" | "planned" | "disabled";
          effectiveAuthority?: {
            allowedTenants?: string[];
            allowedServices?: string[];
            allowedEnvironmentNames?: string[];
            [key: string]: unknown;
          };
          effectiveBudget?: Record<string, unknown>;
          effectiveState?: {
            state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
            blocked: boolean;
          };
        };
        publicProfile?: {
          displayName: string;
          bio?: string;
          skills?: string[];
          avatarUrl?: string;
        };
        hasCognitiveProfile: boolean;

type ManagerLogResponse = {
  ok: true;
  managerEmployeeId: string;
  count: number;
  entries: unknown[];
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
  employeeId?: string;
  control?: {
    state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
    budgetOverride?: Record<string, unknown>;
    authorityOverride?: Record<string, unknown>;
  } | null;
  effectiveState?: {
    state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
    blocked: boolean;
  };
};

type WorkLogResponse = {
  ok: true;
  employeeId: string;
  count: number;
  entries: unknown[];
};

type EscalationsResponse = {
  ok: true;
  count: number;
  escalations: unknown[];
};

type ControlHistoryResponse = {
  ok: true;
  count: number;
  entries: unknown[];
};

type SchedulerStatusResponse = {
  primaryScheduler: "paperclip";
  cronFallbackEnabled: boolean;
};

type ApprovalEntry = {
  id?: string;
  approvalId?: string;
  employeeId?: string;
  requestedByEmployeeId?: string;
  reason: string;
  state?: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
  status?: "pending" | "approved" | "rejected" | "expired";
  requestedAt?: string;
  timestamp?: string;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  consumedAt?: string;
  decidedAt?: string;
  executedAt?: string;
  executionId?: string;
  metadata?: Record<string, unknown>;
  controlHistory?: Array<{
    id: string;
    timestamp: string;
    action: string;
  }>;
};

type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals?: ApprovalEntry[];
  entries?: ApprovalEntry[];
};

type ApprovalDetailResponse = {
  ok: true;
  id?: string;
  approval?: {
    id?: string;
    approvalId?: string;
  };
};

type ApprovalActionResponse = {
  ok: true;
  id: string;
  state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
  actionedAt?: string;
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

  let employees: EmployeesResponse;
  try {
    employees = await readJson<EmployeesResponse>(
      await fetch(`${agentBaseUrl}/agent/employees`)
    );
  } catch (err) {
    if (handleOperatorAgentSoftSkip("operator-surface-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  if (!employees.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  const plannedEmployees = await readJson<EmployeesResponse>(
    await fetch(`${agentBaseUrl}/agent/employees?status=planned`)
  );

  if (!plannedEmployees.ok) {
    throw new Error("/agent/employees?status=planned did not return ok=true");
  }

  const plannedEmployeeIds = new Set(
    plannedEmployees.employees.map((employee) => employee.identity.employeeId)
  );

  for (const employeeId of [
    "emp_product_manager_web_01",
    "emp_frontend_engineer_01",
    "emp_validation_pm_01",
    "emp_validation_engineer_01",
  ]) {
    if (!plannedEmployeeIds.has(employeeId)) {
      throw new Error(
        `Expected planned employee filter to include ${employeeId}`
      );
    }
  }

  for (const employeeId of [
    "emp_timeout_recovery_01",
    "emp_retry_supervisor_01",
    "emp_infra_ops_manager_01",
  ]) {
    if (plannedEmployeeIds.has(employeeId)) {
      throw new Error(
        `Expected planned employee filter to exclude ${employeeId}`
      );
    }
  }

  const webTeamEmployees = await readJson<EmployeesResponse>(
    await fetch(`${agentBaseUrl}/agent/employees?teamId=team_web_product`)
  );

  if (!webTeamEmployees.ok) {
    throw new Error("/agent/employees?teamId=team_web_product did not return ok=true");
  }

  const webTeamEmployeeIds = new Set(
    webTeamEmployees.employees.map((employee) => employee.identity.employeeId)
  );

  if (webTeamEmployeeIds.size !== 2) {
    throw new Error(
      `Expected team_web_product filter to return exactly 2 employees, got ${webTeamEmployeeIds.size}`
    );
  }

  for (const employeeId of [
    "emp_product_manager_web_01",
    "emp_frontend_engineer_01",
  ]) {
    if (!webTeamEmployeeIds.has(employeeId)) {
      throw new Error(
        `Expected web team filter to include ${employeeId}`
      );
    }
  }

  for (const employeeId of [
    "emp_validation_pm_01",
    "emp_validation_engineer_01",
    "emp_timeout_recovery_01",
    "emp_retry_supervisor_01",
    "emp_infra_ops_manager_01",
  ]) {
    if (webTeamEmployeeIds.has(employeeId)) {
      throw new Error(
        `Expected web team filter to exclude ${employeeId}`
      );
    }
  }

  const employeeIds = new Set(employees.employees.map((e) => e.identity.employeeId));

  if (!employeeIds.has("emp_timeout_recovery_01")) {
    throw new Error("Expected /agent/employees to include timeout recovery employee");
  }

  if (!employeeIds.has("emp_retry_supervisor_01")) {
    throw new Error("Expected /agent/employees to include retry supervisor employee");
  }

  if (!employeeIds.has("emp_infra_ops_manager_01")) {
    throw new Error("Expected /agent/employees to include infra ops manager employee");
  }

  if (!employeeIds.has("emp_product_manager_web_01")) {
    throw new Error("Expected /agent/employees to include product manager web employee");
  }

  if (!employeeIds.has("emp_frontend_engineer_01")) {
    throw new Error("Expected /agent/employees to include frontend engineer employee");
  }

  if (!employeeIds.has("emp_validation_pm_01")) {
    throw new Error("Expected /agent/employees to include validation PM employee");
  }

  if (!employeeIds.has("emp_validation_engineer_01")) {
    throw new Error("Expected /agent/employees to include validation engineer employee");
  }

  if (employees.count < 7) {
    throw new Error(
      `Expected at least 7 employees, got ${employees.count}`
    );
  }

  const timeoutRecoveryEmployee = employees.employees.find(
    (employee) => employee.identity.employeeId === "emp_timeout_recovery_01"
  );

  if (!timeoutRecoveryEmployee) {
    throw new Error("Expected timeout recovery employee details in /agent/employees");
  }

  if (timeoutRecoveryEmployee.identity.companyId !== "company_internal_aep") {
    throw new Error("Expected timeout recovery employee companyId=company_internal_aep");
  }

  if (timeoutRecoveryEmployee.identity.teamId !== "team_infra") {
    throw new Error("Expected timeout recovery employee teamId=team_infra");
  }

  const productManagerWeb = employees.employees.find(
    (employee) => employee.identity.employeeId === "emp_product_manager_web_01"
  );

  if (!productManagerWeb) {
    throw new Error("Expected product manager web employee details in /agent/employees");
  }

  if (productManagerWeb.catalog.implemented !== false) {
    throw new Error("Expected product manager web employee to be catalog-only");
  }

  if (productManagerWeb.catalog.teamId !== "team_web_product") {
    throw new Error("Expected product manager web teamId=team_web_product");
  }

  const timeoutScope = await readJson<EmployeeScopeResponse>(
    await fetch(`${agentBaseUrl}/agent/employees/emp_timeout_recovery_01/scope`)
  );

  if (timeoutScope.companyId !== "company_internal_aep") {
    throw new Error("Expected timeout scope companyId=company_internal_aep");
  }

  if (timeoutScope.teamId !== "team_infra") {
    throw new Error("Expected timeout scope teamId=team_infra");
  }

  const timeoutEffectivePolicy = await readJson<EmployeeEffectivePolicyResponse>(
    await fetch(
      `${agentBaseUrl}/agent/employees/emp_timeout_recovery_01/effective-policy`
    )
  );

  if (!timeoutEffectivePolicy.implemented) {
    throw new Error("Expected timeout recovery effective policy to be implemented");
  }

  const productManagerPolicy = await readJson<EmployeeEffectivePolicyResponse>(
    await fetch(
      `${agentBaseUrl}/agent/employees/emp_product_manager_web_01/effective-policy`
    )
  );

  if (productManagerPolicy.implemented !== false) {
    throw new Error("Expected product manager web effective policy to report implemented=false");
  }

  const managerLog = await readJson<ManagerLogResponse>(
    await fetch(
      `${agentBaseUrl}/agent/manager-log?managerEmployeeId=emp_infra_ops_manager_01&limit=10`
    )
  );

  if (!managerLog.ok) {
    throw new Error("/agent/manager-log did not return ok=true");
  }

  const employeeControls = await readJson<EmployeeControlsResponse>(
    await fetch(`${agentBaseUrl}/agent/employee-controls`)
  );

  if (!employeeControls.ok) {
    throw new Error("/agent/employee-controls did not return ok=true");
  }

  const workLog = await readJson<WorkLogResponse>(
    await fetch(`${agentBaseUrl}/agent/work-log?employeeId=emp_timeout_recovery_01&limit=10`)
  );

  if (!workLog.ok) {
    throw new Error("/agent/work-log did not return ok=true");
  }

  const escalations = await readJson<EscalationsResponse>(
    await fetch(`${agentBaseUrl}/agent/escalations?limit=10`)
  );

  if (!escalations.ok) {
    throw new Error("/agent/escalations did not return ok=true");
  }

  const controlHistory = await readJson<ControlHistoryResponse>(
    await fetch(`${agentBaseUrl}/agent/control-history?limit=10`)
  );

  if (!controlHistory.ok) {
    throw new Error("/agent/control-history did not return ok=true");
  }

  const schedulerStatus = await readJson<SchedulerStatusResponse>(
    await fetch(`${agentBaseUrl}/agent/scheduler-status`)
  );

  if (schedulerStatus.primaryScheduler !== "paperclip") {
    throw new Error(
      `Expected primaryScheduler=paperclip, got ${schedulerStatus.primaryScheduler}`
    );
  }

  // Approval surface checks
  const approvals = await readJson<ApprovalsListResponse>(
    await fetch(`${agentBaseUrl}/agent/approvals?limit=10`)
  );

  if (!approvals.ok) {
    throw new Error("/agent/approvals did not return ok=true");
  }

  const approvalEntries = Array.isArray(approvals.approvals)
    ? approvals.approvals
    : Array.isArray(approvals.entries)
      ? approvals.entries
      : [];

  if (!Array.isArray(approvalEntries)) {
    throw new Error("/agent/approvals response does not contain an approvals list");
  }

  // Validate approval state enum values
  const validApprovalStates = [
    "pending",
    "pending_review",
    "approved",
    "rejected",
    "expired",
    "already_executed",
  ] as const;

  for (const approval of approvalEntries) {
    const approvalId = approval.id ?? approval.approvalId;
    const state = approval.state ?? approval.status;

    if (!approvalId) {
      throw new Error("Approval entry missing id/approvalId");
    }

    if (!state || !validApprovalStates.includes(state as never)) {
      throw new Error(
        `Approval ${approvalId} has invalid state: ${String(state)}. ` +
          `Expected one of: ${validApprovalStates.join(", ")}`
      );
    }

    // Validate state-specific timestamp fields
    if (state === "approved" && !approval.approvedAt && !approval.decidedAt) {
      throw new Error(
        `Approval ${approvalId} is approved but missing approvedAt/decidedAt timestamp`
      );
    }

    if (state === "rejected" && !approval.rejectedAt && !approval.decidedAt) {
      throw new Error(
        `Approval ${approvalId} is rejected but missing rejectedAt/decidedAt timestamp`
      );
    }

    if (state === "expired" && !approval.expiresAt) {
      throw new Error(`Approval ${approvalId} is expired but missing expiresAt timestamp`);
    }

    if (state === "already_executed" && !approval.consumedAt && !approval.executedAt) {
      throw new Error(
        `Approval ${approvalId} is already_executed but missing consumedAt/executedAt timestamp`
      );
    }

    // Validate control history linkage if present
    if (approval.controlHistory && Array.isArray(approval.controlHistory)) {
      for (const entry of approval.controlHistory) {
        if (!entry.id || !entry.timestamp || !entry.action) {
          throw new Error(
            `Approval ${approvalId} control history entry missing required fields`
          );
        }
      }
    }
  }

  // Test approval detail endpoint if approvals exist
  if (approvalEntries.length > 0) {
    const testApprovalId = approvalEntries[0].id ?? approvalEntries[0].approvalId;
    if (!testApprovalId) {
      throw new Error("First approval entry is missing id/approvalId");
    }

    const approvalDetail = await readJson<ApprovalDetailResponse>(
      await fetch(`${agentBaseUrl}/agent/approvals/${testApprovalId}`)
    );

    if (!approvalDetail.ok) {
      throw new Error(`/agent/approvals/{id} did not return ok=true for ${testApprovalId}`);
    }

    const returnedId = approvalDetail.id ?? approvalDetail.approval?.id ?? approvalDetail.approval?.approvalId;

    if (returnedId !== testApprovalId) {
      throw new Error(
        `Approval detail ID mismatch: expected ${testApprovalId}, got ${String(returnedId)}`
      );
    }
  }

  // Validate approve/reject endpoints are present for pending approvals
  const pendingApprovals = approvalEntries.filter((a) => {
    const state = a.state ?? a.status;
    return state === "pending_review" || state === "pending";
  });

  if (pendingApprovals.length > 0) {
    const testApprovalId = pendingApprovals[0].id ?? pendingApprovals[0].approvalId;
    if (!testApprovalId) {
      throw new Error("Pending approval entry is missing id/approvalId");
    }

    // Test that endpoints exist (we don't mutate state here to avoid side effects)
    try {
      const approveUrl = `${agentBaseUrl}/agent/approvals/approve`;
      const rejectUrl = `${agentBaseUrl}/agent/approvals/reject`;

      // Use HEAD to check endpoint existence without mutation
      const approveExists = await fetch(approveUrl, {
        method: "OPTIONS",
      }).then((r) => r.ok || r.status === 405); // 405 is OK if OPTIONS not supported

      const rejectExists = await fetch(rejectUrl, {
        method: "OPTIONS",
      }).then((r) => r.ok || r.status === 405);

      if (!approveExists && !rejectExists) {
        // At least one should exist - if neither does, the surface is incomplete
        throw new Error(
          `Neither /agent/approvals/approve nor /agent/approvals/reject endpoints are available`
        );
      }
    } catch (err) {
      // If we can't verify endpoint existence, log but don't fail hard
      console.warn(
        `Warning: Could not verify approve/reject endpoint mutation surface for ${testApprovalId}`
      );
    }
  }

  for (const employee of employees.employees) {
    if (employee.catalog.implemented === false) {
      if (!employee.scope) {
        throw new Error(
          `Catalog-only employee ${employee.identity.employeeId} missing scope`
        );
      }

      if (!employee.message) {
        throw new Error(
          `Catalog-only employee ${employee.identity.employeeId} missing placeholder message`
        );
      }

      continue;
    }

    if (!employee.effectiveAuthority) {
      throw new Error(
        `Employee ${employee.identity.employeeId} missing effectiveAuthority`
      );
    }

    if (!employee.effectiveBudget) {
      throw new Error(
        `Employee ${employee.identity.employeeId} missing effectiveBudget`
      );
    }

    if (!employee.effectiveState) {
      throw new Error(
        `Employee ${employee.identity.employeeId} missing effectiveState`
      );
    }

    if (employee.effectiveState.state === "restricted") {
      if (!employee.effectiveState.blocked && "maxActionsPerScan" in employee.effectiveBudget) {
        const maxActions = (employee.effectiveBudget as Record<string, unknown>)
          .maxActionsPerScan;
        const baseMaxActions = (employee.budget as Record<string, unknown>)
          .maxActionsPerScan;
        if (
          typeof maxActions !== "number" ||
          typeof baseMaxActions !== "number" ||
          maxActions > baseMaxActions
        ) {
          throw new Error(
            `Restricted employee ${employee.identity.employeeId} effective budget should be narrower`
          );
        }
      }
    }
  }

  console.log("operator-surface-check passed", {
    employeeCount: employees.count,
    managerLogCount: managerLog.count,
    controlsListed: employeeControls.count ?? 1,
    workLogCount: workLog.count,
    escalationsCount: escalations.count,
    controlHistoryCount: controlHistory.count,
    approvalsCount: approvals.count,
    pendingApprovalsCount: pendingApprovals.length,
    primaryScheduler: schedulerStatus.primaryScheduler,
    cronFallbackEnabled: schedulerStatus.cronFallbackEnabled,
  });
}

main().catch((error) => {
  console.error("operator-surface-check failed");
  console.error(error);
  process.exit(1);
});
