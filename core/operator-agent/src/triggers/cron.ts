import { getConfig } from "@aep/operator-agent/config";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import { timeoutRecoveryEmployee } from "@aep/operator-agent/org/employees";
import type { EmployeeRunRequest, OperatorAgentEnv } from "@aep/operator-agent/types";

export async function handleCron(
  env: OperatorAgentEnv
): Promise<void> {
  const config = getConfig(env);
  const employee = timeoutRecoveryEmployee;

  const runRequest: EmployeeRunRequest = {
    departmentId: employee.identity.departmentId,
    employeeId: employee.identity.employeeId,
    roleId: employee.identity.roleId,
    trigger: "cron",
    policyVersion: config.policyVersion,
  };

  const result = await executeEmployeeRun(runRequest, env);

  console.log("[operator-agent] cron run completed", {
    employeeId: result.employee.employeeId,
    dryRun: result.dryRun,
    scanned: result.scanned,
    summary: result.summary,
  });
}
