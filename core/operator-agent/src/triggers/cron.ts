import { getConfig } from "../config";
import { runTimeoutRecoveryOperator } from "../agents/timeout-recovery";
import { timeoutRecoveryEmployee } from "../org/employees";
import type { EmployeeRunRequest, OperatorAgentEnv } from "../types";

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
    policyVersion: config.policyVersion
  };

  const result = await runTimeoutRecoveryOperator(runRequest, env);

  console.log("[operator-agent] cron run completed", {
    employeeId: result.employee.employeeId,
    dryRun: result.dryRun,
    scanned: result.scanned,
    summary: result.summary
  });
}
