/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { getApprovalEntries } from "../../contracts/approvals";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";

export {};

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  let employeesResponse;
  try {
    employeesResponse = await client.listEmployees();
  } catch (err) {
    if (handleOperatorAgentSoftSkip("operator-agent-contract-check", err)) {
      process.exit(0);
    }
    throw err;
  }

  if (!employeesResponse.ok) {
    throw new Error("/agent/employees did not return ok=true");
  }

  const employees = employeesResponse.employees;

  const rolesResponse = await client.listRoles();
  if (!rolesResponse.ok) {
    throw new Error("/agent/roles did not return ok=true");
  }

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
    throw new Error("Expected timeout recovery employee runtimeStatus=implemented");
  }

  if (timeoutRecoveryEmployee.employment.employmentStatus !== "active") {
    throw new Error("Expected timeout recovery employee employmentStatus=active");
  }

  if (!Array.isArray(timeoutRecoveryEmployee.publicLinks)) {
    throw new Error("Expected timeout recovery employee publicLinks array");
  }

  const productManagerWeb = employees.find(
    (employee) => employee.identity.employeeId === "emp_product_manager_web_01",
  );

  if (!productManagerWeb) {
    throw new Error("Expected product manager web employee details in /agent/employees");
  }

  if (productManagerWeb.runtime.runtimeStatus !== "planned") {
    throw new Error("Expected product manager web employee to be planned");
  }

  if (productManagerWeb.identity.teamId !== "team_web_product") {
    throw new Error("Expected product manager web teamId=team_web_product");
  }

  if (productManagerWeb.employment.employmentStatus !== "active") {
    throw new Error("Expected product manager web employmentStatus=active");
  }

  const lifecycleTestEmployee = await client.createEmployee({
    teamId: "team_web_product",
    roleId: "product-manager-web",
    employeeName: `Lifecycle Test ${Date.now()}`,
    employmentStatus: "draft",
    runtimeStatus: "planned",
    schedulerMode: "manual_only",
    bio: "Lifecycle test employee",
    tone: "Professional",
    skills: ["Planning"],
    appearanceSummary: "Test employee for lifecycle contract checks.",
    birthYear: 1993,
    reason: "CI lifecycle contract check",
    approvedBy: "ci-operator-agent-client",
  });

  if (!lifecycleTestEmployee.ok || !lifecycleTestEmployee.employeeId) {
    throw new Error("Expected employee creation to succeed for lifecycle test");
  }

  const lifecycleEmployeeId = String(lifecycleTestEmployee.employeeId);

  const draftEmployees = await client.listEmployees({ employmentStatus: "draft" });
  if (!draftEmployees.ok) {
    throw new Error("/agent/employees?employmentStatus=draft did not return ok=true");
  }

  if (
    !draftEmployees.employees.some(
      (employee) => employee.identity.employeeId === lifecycleEmployeeId,
    )
  ) {
    throw new Error("Expected lifecycle test employee in draft employment filter");
  }

  const activateResult = await client.runEmployeeLifecycleAction(
    lifecycleEmployeeId,
    "activate",
    {
      reason: "CI activate check",
    },
  );
  if (!activateResult.ok || activateResult.employmentStatus !== "active") {
    throw new Error("Expected activate lifecycle action to succeed");
  }

  const changeRoleResult = await client.runEmployeeLifecycleAction(
    lifecycleEmployeeId,
    "change-role",
    {
      toRoleId: "frontend-engineer",
      reason: "CI change-role check",
    },
  );
  if (!changeRoleResult.ok || changeRoleResult.roleId !== "frontend-engineer") {
    throw new Error("Expected change-role lifecycle action to succeed");
  }

  const leaveResult = await client.runEmployeeLifecycleAction(
    lifecycleEmployeeId,
    "start-leave",
    {
      reason: "CI leave check",
    },
  );
  if (!leaveResult.ok || leaveResult.employmentStatus !== "on_leave") {
    throw new Error("Expected start-leave lifecycle action to succeed");
  }

  const returnResult = await client.runEmployeeLifecycleAction(
    lifecycleEmployeeId,
    "end-leave",
    {
      reason: "CI return check",
    },
  );
  if (!returnResult.ok || returnResult.employmentStatus !== "active") {
    throw new Error("Expected end-leave lifecycle action to succeed");
  }

  const retireResult = await client.runEmployeeLifecycleAction(
    lifecycleEmployeeId,
    "retire",
    {
      reason: "CI retire check",
      approvedBy: "ci-operator-agent-client",
    },
  );
  if (!retireResult.ok || retireResult.employmentStatus !== "retired") {
    throw new Error("Expected retire lifecycle action to succeed");
  }

  const rehireResult = await client.runEmployeeLifecycleAction(
    lifecycleEmployeeId,
    "rehire",
    {
      reason: "CI rehire check",
    },
  );
  if (!rehireResult.ok || rehireResult.employmentStatus !== "active") {
    throw new Error("Expected rehire lifecycle action to succeed");
  }

  const terminateResult = await client.runEmployeeLifecycleAction(
    lifecycleEmployeeId,
    "terminate",
    {
      reason: "CI terminate check",
      approvedBy: "ci-operator-agent-client",
    },
  );
  if (!terminateResult.ok || terminateResult.employmentStatus !== "terminated") {
    throw new Error("Expected terminate lifecycle action to succeed");
  }

  const archiveResult = await client.runEmployeeLifecycleAction(
    lifecycleEmployeeId,
    "archive",
    {
      reason: "CI archive check",
      approvedBy: "ci-operator-agent-client",
    },
  );
  if (!archiveResult.ok || archiveResult.employmentStatus !== "archived") {
    throw new Error("Expected archive lifecycle action to succeed");
  }

  const lifecycleEvents = await client.getEmployeeEmploymentEvents(
    lifecycleEmployeeId,
  );
  if (!lifecycleEvents.ok || lifecycleEvents.count < 7) {
    throw new Error("Expected lifecycle test employee employment events to exist");
  }

  const lifecycleEventTypes = new Set(
    lifecycleEvents.events.map((event) => event.eventType),
  );

  for (const eventType of [
    "hired",
    "activated",
    "role_changed",
    "went_on_leave",
    "returned_from_leave",
    "retired",
    "rehired",
    "terminated",
    "archived",
  ]) {
    if (!lifecycleEventTypes.has(eventType as any)) {
      throw new Error(`Expected lifecycle event ${eventType} to be recorded`);
    }
  }

  const productManagerWebRole = rolesResponse.roles.find(
    (role) => role.roleId === "product-manager-web",
  );

  if (!productManagerWebRole) {
    throw new Error("Expected /agent/roles to include product-manager-web");
  }

  if (productManagerWebRole.teamId !== "team_web_product") {
    throw new Error("Expected product-manager-web role teamId=team_web_product");
  }

  if (
    !Array.isArray(productManagerWebRole.responsibilities) ||
    productManagerWebRole.responsibilities.length === 0
  ) {
    throw new Error("Expected product-manager-web role to expose responsibilities");
  }

  const timeoutScope = await client.getEmployeeScope("emp_timeout_recovery_01");
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
    throw new Error("Expected timeout recovery effective policy to be implemented");
  }

  const productManagerPolicy = await client.getEmployeeEffectivePolicy(
    "emp_product_manager_web_01",
  );

  if (!productManagerPolicy.ok || productManagerPolicy.implemented !== false) {
    throw new Error("Expected product manager web effective policy to report implemented=false");
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

  console.log("operator-agent-contract-check passed", {
    employeeCount: employeesResponse.count,
    roleCount: rolesResponse.count,
    lifecycleEventCount: lifecycleEvents.count,
    managerLogCount: managerLog.count,
    controlsListed: employeeControls.count,
    workLogCount: workLog.count,
    escalationsCount: escalations.count,
    controlHistoryCount: controlHistory.count,
    approvalsCount: approvals.count,
    primaryScheduler: schedulerStatus.primaryScheduler,
    cronFallbackEnabled: schedulerStatus.cronFallbackEnabled,
  });
}

main().catch((error) => {
  console.error("operator-agent-contract-check failed");
  console.error(error);
  process.exit(1);
});