/* eslint-disable no-console */

import { createOperatorAgentClient } from "./clients/operator-agent-client";
import type { EmployeeProjection } from "./contracts/employees";
import {
  getApprovalEntries,
  VALID_APPROVAL_STATES,
} from "./contracts/approvals";
import { handleOperatorAgentSoftSkip } from "./shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  let employeesResponse;
  try {
    employeesResponse = await client.listEmployees();
  } catch (err) {
    if (handleOperatorAgentSoftSkip("operator-surface-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  if (!employeesResponse.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  const employees = employeesResponse.employees;

  const plannedEmployees = await client.listEmployees({ status: "planned" });
  if (!plannedEmployees.ok) {
    throw new Error("/agent/employees?status=planned did not return ok=true");
  }

  const plannedEmployeeIds = new Set(
    plannedEmployees.employees.map((employee) => employee.identity.employeeId),
  );

  for (const employeeId of [
    "emp_product_manager_web_01",
    "emp_frontend_engineer_01",
    "emp_validation_pm_01",
    "emp_validation_engineer_01",
  ]) {
    if (!plannedEmployeeIds.has(employeeId)) {
      throw new Error(
        `Expected planned employee filter to include ${employeeId}`,
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
        `Expected planned employee filter to exclude ${employeeId}`,
      );
    }
  }

  const webTeamEmployees = await client.listEmployees({
    teamId: "team_web_product",
  });

  if (!webTeamEmployees.ok) {
    throw new Error("/agent/employees?teamId=team_web_product did not return ok=true");
  }

  const webTeamEmployeeIds = new Set(
    webTeamEmployees.employees.map((employee) => employee.identity.employeeId),
  );

  if (webTeamEmployeeIds.size !== 2) {
    throw new Error(
      `Expected team_web_product filter to return exactly 2 employees, got ${webTeamEmployeeIds.size}`,
    );
  }

  for (const employeeId of [
    "emp_product_manager_web_01",
    "emp_frontend_engineer_01",
  ]) {
    if (!webTeamEmployeeIds.has(employeeId)) {
      throw new Error(`Expected web team filter to include ${employeeId}`);
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
      throw new Error(`Expected web team filter to exclude ${employeeId}`);
    }
  }

  const employeeIds = new Set(employees.map((e) => e.identity.employeeId));

  for (const employeeId of [
    "emp_timeout_recovery_01",
    "emp_retry_supervisor_01",
    "emp_infra_ops_manager_01",
    "emp_product_manager_web_01",
    "emp_frontend_engineer_01",
    "emp_validation_pm_01",
    "emp_validation_engineer_01",
  ]) {
    if (!employeeIds.has(employeeId)) {
      throw new Error(`Expected /agent/employees to include ${employeeId}`);
    }
  }

  if (employeesResponse.count < 7) {
    throw new Error(`Expected at least 7 employees, got ${employeesResponse.count}`);
  }

  const timeoutRecoveryEmployee = employees.find(
    (employee) => employee.identity.employeeId === "emp_timeout_recovery_01",
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

  if (timeoutRecoveryEmployee.runtime.runtimeStatus !== "implemented") {
    throw new Error(
      `Expected timeout recovery employee runtimeStatus=implemented, got ${JSON.stringify(timeoutRecoveryEmployee)}`,
    );
  }

  const productManagerWeb = employees.find(
    (employee) => employee.identity.employeeId === "emp_product_manager_web_01",
  );

  if (!productManagerWeb) {
    throw new Error("Expected product manager web employee details in /agent/employees");
  }

  if (productManagerWeb.runtime.runtimeStatus !== "planned") {
    throw new Error(
      `Expected product manager web employee to be planned, got ${JSON.stringify(productManagerWeb)}`,
    );
  }

  if (productManagerWeb.identity.teamId !== "team_web_product") {
    throw new Error("Expected product manager web teamId=team_web_product");
  }

  const timeoutScope = await client.getEmployeeScope(
    "emp_timeout_recovery_01",
  );

  if (!timeoutScope.ok) {
    throw new Error("/agent/employees/:id/scope did not return ok=true");
  }

  if (timeoutScope.companyId !== "company_internal_aep") {
    throw new Error("Expected timeout scope companyId=company_internal_aep");
  }

  if (timeoutScope.teamId !== "team_infra") {
    throw new Error("Expected timeout scope teamId=team_infra");
  }

  const timeoutEffectivePolicy = await client.getEmployeeEffectivePolicy(
    "emp_timeout_recovery_01",
  );

  if (!timeoutEffectivePolicy.ok || timeoutEffectivePolicy.implemented !== true) {
    throw new Error(
      `Expected timeout recovery effective policy to be implemented, got ${JSON.stringify(timeoutEffectivePolicy)}`,
    );
  }

  const productManagerPolicy = await client.getEmployeeEffectivePolicy(
    "emp_product_manager_web_01",
  );

  if (!productManagerPolicy.ok || productManagerPolicy.implemented !== false) {
    throw new Error(
      `Expected product manager web effective policy to report implemented=false, got ${JSON.stringify(productManagerPolicy)}`,
    );
  }

  const managerLog = await client.getManagerLog({
    managerEmployeeId: "emp_infra_ops_manager_01",
    limit: 10,
  });

  if (!managerLog.ok) {
    throw new Error("/agent/manager-log did not return ok=true");
  }

  const employeeControls = await client.listEmployeeControls();

  if (!employeeControls.ok) {
    throw new Error("/agent/employee-controls did not return ok=true");
  }

  const workLog = await client.getWorkLog({
    employeeId: "emp_timeout_recovery_01",
    limit: 10,
  });

  if (!workLog.ok) {
    throw new Error("/agent/work-log did not return ok=true");
  }

  const escalations = await client.listEscalations({ limit: 10 });

  if (!escalations.ok) {
    throw new Error("/agent/escalations did not return ok=true");
  }

  const controlHistory = await client.listControlHistory({ limit: 10 });

  if (!controlHistory.ok) {
    throw new Error("/agent/control-history did not return ok=true");
  }

  const schedulerStatus = await client.getSchedulerStatus();

  if (schedulerStatus.primaryScheduler !== "paperclip") {
    throw new Error(
      `Expected primaryScheduler=paperclip, got ${schedulerStatus.primaryScheduler}`,
    );
  }

  const approvals = await client.listApprovals({ limit: 10 });

  if (!approvals.ok) {
    throw new Error("/agent/approvals did not return ok=true");
  }

  const approvalEntries = getApprovalEntries(approvals);

  const validApprovalStates = new Set<string>(VALID_APPROVAL_STATES);

  for (const approval of approvalEntries) {
    const approvalId = approval.id ?? approval.approvalId;
    const state = approval.state ?? approval.status;

    if (!approvalId) {
      throw new Error("Approval entry missing id/approvalId");
    }

    if (!state || !validApprovalStates.has(state)) {
      throw new Error(
        `Approval ${approvalId} has invalid state: ${String(state)}. Expected one of: ${VALID_APPROVAL_STATES.join(", ")}`,
      );
    }

    if (state === "approved" && !approval.approvedAt && !approval.decidedAt) {
      throw new Error(
        `Approval ${approvalId} is approved but missing approvedAt/decidedAt timestamp`,
      );
    }

    if (state === "rejected" && !approval.rejectedAt && !approval.decidedAt) {
      throw new Error(
        `Approval ${approvalId} is rejected but missing rejectedAt/decidedAt timestamp`,
      );
    }

    if (state === "expired" && !approval.expiresAt) {
      throw new Error(
        `Approval ${approvalId} is expired but missing expiresAt timestamp`,
      );
    }

    if (
      state === "already_executed" &&
      !approval.consumedAt &&
      !approval.executedAt
    ) {
      throw new Error(
        `Approval ${approvalId} is already_executed but missing consumedAt/executedAt timestamp`,
      );
    }

    if (approval.controlHistory && Array.isArray(approval.controlHistory)) {
      for (const entry of approval.controlHistory) {
        if (!entry.id || !entry.timestamp || !entry.action) {
          throw new Error(
            `Approval ${approvalId} control history entry missing required fields`,
          );
        }
      }
    }
  }

  if (approvalEntries.length > 0) {
    const testApprovalId =
      approvalEntries[0].id ?? approvalEntries[0].approvalId;

    if (!testApprovalId) {
      throw new Error("First approval entry is missing id/approvalId");
    }

    const approvalDetail = await client.getApproval(testApprovalId);

    if (!approvalDetail.ok) {
      throw new Error(
        `/agent/approvals/{id} did not return ok=true for ${testApprovalId}`,
      );
    }

    const returnedId =
      approvalDetail.id ??
      approvalDetail.approval?.id ??
      approvalDetail.approval?.approvalId;

    if (returnedId !== testApprovalId) {
      throw new Error(
        `Approval detail ID mismatch: expected ${testApprovalId}, got ${String(returnedId)}`,
      );
    }
  }

  const pendingApprovals = approvalEntries.filter((approval) => {
    const state = approval.state ?? approval.status;
    return state === "pending_review" || state === "pending";
  });

  if (pendingApprovals.length > 0) {
    const approveExists = await client.endpointExists("/agent/approvals/approve");
    const rejectExists = await client.endpointExists("/agent/approvals/reject");

    if (!approveExists && !rejectExists) {
      throw new Error(
        "Neither /agent/approvals/approve nor /agent/approvals/reject endpoints are available",
      );
    }
  }

  for (const employee of employees) {
    validateEmployeeProjection(employee);
  }

  console.log("operator-surface-check passed", {
    employeeCount: employeesResponse.count,
    managerLogCount: managerLog.count,
    controlsListed: employeeControls.count,
    workLogCount: workLog.count,
    escalationsCount: escalations.count,
    controlHistoryCount: controlHistory.count,
    approvalsCount: approvals.count,
    pendingApprovalsCount: pendingApprovals.length,
    primaryScheduler: schedulerStatus.primaryScheduler,
    cronFallbackEnabled: schedulerStatus.cronFallbackEnabled,
  });
}

function validateEmployeeProjection(employee: EmployeeProjection): void {
  const runtimeStatus = employee.runtime.runtimeStatus;

  if (runtimeStatus === "planned") {
    if (employee.runtime.effectiveAuthority) {
      throw new Error(
        `Planned employee ${employee.identity.employeeId} should not expose effectiveAuthority in /agent/employees`,
      );
    }

    if (employee.runtime.effectiveBudget) {
      throw new Error(
        `Planned employee ${employee.identity.employeeId} should not expose effectiveBudget in /agent/employees`,
      );
    }

    if (employee.runtime.effectiveState) {
      throw new Error(
        `Planned employee ${employee.identity.employeeId} should not expose effectiveState in /agent/employees`,
      );
    }

    return;
  }

  if (runtimeStatus === "disabled") {
    return;
  }

  if (!employee.runtime.effectiveAuthority) {
    throw new Error(
      `Employee ${employee.identity.employeeId} missing runtime.effectiveAuthority`,
    );
  }

  if (!employee.runtime.effectiveBudget) {
    throw new Error(
      `Employee ${employee.identity.employeeId} missing runtime.effectiveBudget`,
    );
  }

  if (!employee.runtime.effectiveState) {
    throw new Error(
      `Employee ${employee.identity.employeeId} missing runtime.effectiveState`,
    );
  }

  if (employee.runtime.effectiveState.state === "restricted") {
    if (
      !employee.runtime.effectiveState.blocked &&
      "maxActionsPerScan" in employee.runtime.effectiveBudget
    ) {
      const maxActions = (
        employee.runtime.effectiveBudget as Record<string, unknown>
      ).maxActionsPerScan;

      if (typeof maxActions !== "number") {
        throw new Error(
          `Restricted employee ${employee.identity.employeeId} effective budget maxActionsPerScan should be numeric`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error("operator-surface-check failed");
  console.error(error);
  process.exit(1);
});