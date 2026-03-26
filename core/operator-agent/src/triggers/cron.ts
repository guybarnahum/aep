import { getConfig } from "@aep/operator-agent/config";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import { timeoutRecoveryEmployee } from "@aep/operator-agent/org/employees";
import type {
  EmployeeRunRequest,
  EmployeeRunResponse,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

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

  if (!("dryRun" in result)) {
    throw new Error("Unexpected non-worker response for cron timeout recovery run");
  }

  const workerResult: EmployeeRunResponse = result;

  console.log("[operator-agent] cron run completed", {
    employeeId: workerResult.employee.employeeId,
    dryRun: workerResult.dryRun,
    scanned: workerResult.scanned,
    summary: workerResult.summary,
  });
}
