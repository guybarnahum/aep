import { getConfig } from "@aep/operator-agent/config";
import { makeCronFallbackContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import { COMPANY_INTERNAL_AEP } from "@aep/operator-agent/org/company";
import { TEAM_INFRA } from "@aep/operator-agent/org/teams";
import { resolveRuntimeEmployeeByRole } from "@aep/operator-agent/persistence/d1/runtime-employee-resolver-d1";
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
  const employee = await resolveRuntimeEmployeeByRole({
    env,
    companyId: COMPANY_INTERNAL_AEP,
    teamId: TEAM_INFRA,
    roleId: "infra-ops-manager",
  });

  if (!employee) {
    throw new Error("Unable to resolve active infra-ops-manager from D1");
  }

  const executionContext = makeCronFallbackContext(employee.identity.employeeId);

  const runRequest: EmployeeRunRequest = {
    companyId: employee.identity.companyId,
    teamId: employee.identity.teamId,
    employeeId: employee.identity.employeeId,
    roleId: employee.identity.roleId,
    trigger: "cron",
    policyVersion: config.policyVersion,
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
