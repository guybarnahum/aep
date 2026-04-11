/* eslint-disable no-console */

import { createOperatorAgentClient } from "../../clients/operator-agent-client";
import { handleOperatorAgentSoftSkip } from "../../shared/soft-skip";
import type { ManagerRunResponse } from "../../contracts/manager";

export {};

const POLICY_VERSION = "commit10-stageB";

async function main(): Promise<void> {
  const client = createOperatorAgentClient();

  const observedEmployeeId =
    process.env.OPERATOR_AGENT_MANAGER_OBSERVED_EMPLOYEE_ID ??
    "emp_timeout_recovery_01";

  // ---- run manager

  const managerRun = await client.runEmployee<ManagerRunResponse>(
    {
      departmentId: "aep-infra-ops",
      employeeId: "emp_infra_ops_manager_01",
      roleId: "infra-ops-manager",
      trigger: "manual",
      policyVersion: POLICY_VERSION,
      targetEmployeeIdOverride: observedEmployeeId,
    },
    {
      executionSource: "operator",
      actor: "ci-manager-policy-overlay-check",
    },
  );

  if (managerRun.policyVersion !== POLICY_VERSION) {
    throw new Error(
      `Unexpected policyVersion from manager run: ${managerRun.policyVersion}`,
    );
  }

  // ---- fetch state

  const controls = await client.getEmployeeControls(observedEmployeeId);

  const effectiveState =
    "effectiveState" in controls && controls.effectiveState
      ? controls.effectiveState
      : { state: "enabled" as const, blocked: false };

  const employees = await client.listEmployees();

  const employee = employees.employees.find(
    (e) => e.identity.employeeId === observedEmployeeId,
  );

  if (!employee) {
    throw new Error("Observed employee missing from /agent/employees");
  }

  const effectivePolicy = await client.getEmployeeEffectivePolicy(
    observedEmployeeId,
  );

  if (!effectivePolicy.ok) {
    throw new Error("Expected /effective-policy ok=true");
  }

  if (!effectivePolicy.implemented) {
    throw new Error("Expected employee to be implemented");
  }

  if (employee.runtime.runtimeStatus !== "implemented") {
    throw new Error("Expected runtimeStatus=implemented");
  }

  // ---- control invariants

  if (
    "control" in controls &&
    controls.control === null &&
    effectiveState.state !== "enabled"
  ) {
    throw new Error("Missing control must imply enabled state");
  }

  if (effectiveState.state === "restricted") {
    if (effectiveState.blocked) {
      throw new Error("Restricted employee must remain runnable");
    }

    const effectiveMax = effectivePolicy.effectiveBudget?.maxActionsPerScan;
    const baseMax = effectivePolicy.baseBudget?.maxActionsPerScan;

    if (
      typeof effectiveMax === "number" &&
      typeof baseMax === "number" &&
      effectiveMax > baseMax
    ) {
      throw new Error("Restricted budget exceeds base budget");
    }
  }

  console.log("manager-policy-overlay-check passed", {
    observedEmployeeId,
    state: effectiveState.state,
    blocked: effectiveState.blocked,
    restrictionDecisions: managerRun.summary.restrictionDecisions,
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