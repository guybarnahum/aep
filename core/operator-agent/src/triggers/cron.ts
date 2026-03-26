import { getConfig } from "@aep/operator-agent/config";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import { retrySupervisorEmployee, timeoutRecoveryEmployee } from "@aep/operator-agent/org/employees";
import type {
  AgentEmployeeDefinition,
  EmployeeRunRequest,
  EmployeeRunResponse,
  OperatorAgentEnv,
} from "@aep/operator-agent/types";

export async function handleWorkerCron(
  env: OperatorAgentEnv
): Promise<void> {
  const config = getConfig(env);

  const workers: AgentEmployeeDefinition[] = [
    timeoutRecoveryEmployee,
    retrySupervisorEmployee,
  ];

  for (const employee of workers) {
    const runRequest: EmployeeRunRequest = {
      departmentId: employee.identity.departmentId,
      employeeId: employee.identity.employeeId,
      roleId: employee.identity.roleId,
      trigger: "cron",
      policyVersion: config.policyVersion,
    };

    const result = await executeEmployeeRun(runRequest, env);

    if (!("dryRun" in result)) {
      throw new Error(
        `Unexpected non-worker response for cron run of ${employee.identity.employeeId}`
      );
    }

    const workerResult: EmployeeRunResponse = result;

    console.log("[operator-agent] worker cron run completed", {
      employeeId: workerResult.employee.employeeId,
      workerRole: workerResult.workerRole,
      dryRun: workerResult.dryRun,
      scanned: workerResult.scanned,
      summary: workerResult.summary,
    });
  }
}
