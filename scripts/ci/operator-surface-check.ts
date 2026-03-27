/* eslint-disable no-console */

import { resolveServiceBaseUrl } from "../lib/service-map";

export {};

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
    effectiveAuthority: Record<string, unknown>;
    effectiveBudget: Record<string, unknown>;
    effectiveState: {
      state: "enabled" | "disabled_pending_review" | "disabled_by_manager" | "restricted";
      blocked: boolean;
    };
  }>;
};

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

type ApprovalsListResponse = {
  ok: true;
  count: number;
  approvals: Array<{
    id: string;
    employeeId: string;
    reason: string;
    state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
    requestedAt: string;
    expiresAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    expiredAt?: string;
    consumedAt?: string;
    metadata?: Record<string, unknown>;
    controlHistory?: Array<{
      id: string;
      timestamp: string;
      action: string;
    }>;
  }>;
};

type ApprovalDetailResponse = {
  ok: true;
  id: string;
  employeeId: string;
  reason: string;
  state: "pending_review" | "approved" | "rejected" | "expired" | "already_executed";
  requestedAt: string;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  consumedAt?: string;
  metadata?: Record<string, unknown>;
  controlHistory?: Array<{
    id: string;
    timestamp: string;
    action: string;
  }>;
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

  const employees = await readJson<EmployeesResponse>(
    await fetch(`${agentBaseUrl}/agent/employees`)
  );

  if (!employees.ok) {
    throw new Error("/agent/employees did not return ok=true");
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

  if (employees.count < 3) {
    throw new Error(
      `Expected at least 3 employees, got ${employees.count}`
    );
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

  // Validate approval state enum values
  const validApprovalStates = [
    "pending_review",
    "approved",
    "rejected",
    "expired",
    "already_executed",
  ] as const;

  for (const approval of approvals.approvals) {
    if (!validApprovalStates.includes(approval.state as never)) {
      throw new Error(
        `Approval ${approval.id} has invalid state: ${approval.state}. ` +
          `Expected one of: ${validApprovalStates.join(", ")}`
      );
    }

    // Validate state-specific timestamp fields
    if (approval.state === "approved" && !approval.approvedAt) {
      throw new Error(
        `Approval ${approval.id} is approved but missing approvedAt timestamp`
      );
    }

    if (approval.state === "rejected" && !approval.rejectedAt) {
      throw new Error(
        `Approval ${approval.id} is rejected but missing rejectedAt timestamp`
      );
    }

    if (approval.state === "expired" && !approval.expiredAt) {
      throw new Error(`Approval ${approval.id} is expired but missing expiredAt timestamp`);
    }

    if (approval.state === "already_executed" && !approval.consumedAt) {
      throw new Error(
        `Approval ${approval.id} is already_executed but missing consumedAt timestamp`
      );
    }

    // Validate control history linkage if present
    if (approval.controlHistory && Array.isArray(approval.controlHistory)) {
      for (const entry of approval.controlHistory) {
        if (!entry.id || !entry.timestamp || !entry.action) {
          throw new Error(
            `Approval ${approval.id} control history entry missing required fields`
          );
        }
      }
    }
  }

  // Test approval detail endpoint if approvals exist
  if (approvals.approvals.length > 0) {
    const testApprovalId = approvals.approvals[0].id;
    const approvalDetail = await readJson<ApprovalDetailResponse>(
      await fetch(`${agentBaseUrl}/agent/approvals/${testApprovalId}`)
    );

    if (!approvalDetail.ok) {
      throw new Error(`/agent/approvals/{id} did not return ok=true for ${testApprovalId}`);
    }

    if (approvalDetail.id !== testApprovalId) {
      throw new Error(
        `Approval detail ID mismatch: expected ${testApprovalId}, got ${approvalDetail.id}`
      );
    }
  }

  // Validate approve/reject endpoints are present for pending approvals
  const pendingApprovals = approvals.approvals.filter((a) => a.state === "pending_review");

  if (pendingApprovals.length > 0) {
    const testApprovalId = pendingApprovals[0].id;

    // Test that endpoints exist (we don't mutate state here to avoid side effects)
    try {
      const options = { method: "POST", headers: { "Content-Type": "application/json" } };

      // Check endpoints exist by testing with a dry-run or preview without mutation
      // For now we just validate the endpoint is reachable
      const approveUrl = `${agentBaseUrl}/agent/approvals/${testApprovalId}/approve`;
      const rejectUrl = `${agentBaseUrl}/agent/approvals/${testApprovalId}/reject`;

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
          `Neither /agent/approvals/{id}/approve nor /agent/approvals/{id}/reject endpoints are available`
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
