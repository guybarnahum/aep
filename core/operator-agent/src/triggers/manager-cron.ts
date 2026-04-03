import { getConfig } from "@aep/operator-agent/config";
import { makeCronFallbackContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import { infraOpsManagerEmployee } from "@aep/operator-agent/org/employees";
import type {
  EmployeeRunRequest,
  ManagerDecisionResponse,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

function isManagerDecisionResponse(value: unknown): value is ManagerDecisionResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "observedEmployeeIds" in value &&
    "decisions" in value &&
    "summary" in value
  );
}

export async function handleManagerCron(
  env: OperatorAgentEnv
): Promise<void> {
  const config = getConfig(env);
  const employee = infraOpsManagerEmployee;
  const executionContext = makeCronFallbackContext(employee.identity.employeeId);

  const runRequest: EmployeeRunRequest = {
    companyId: employee.identity.companyId,
    teamId: employee.identity.teamId,
    employeeId: employee.identity.employeeId,
    roleId: employee.identity.roleId,
    trigger: "cron",
    policyVersion: config.policyVersion,
    targetEmployeeIdsOverride: config.managerObservedEmployeeIds,
  };

  const result = await executeEmployeeRun(runRequest, env, executionContext);

  if (!isManagerDecisionResponse(result)) {
    throw new Error("Unexpected non-manager response for manager cron run");
  }

  console.log("[operator-agent] manager cron run completed", {
    employeeId: result.employee.employeeId,
    observedEmployeeIds: result.observedEmployeeIds,
    scanned: result.scanned,
    summary: result.summary,
    decisionsEmitted: result.decisions.length,
  });
}
