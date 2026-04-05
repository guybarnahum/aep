import { getConfig } from "@aep/operator-agent/config";
import { makeCronFallbackContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import {
  reliabilityEngineerEmployee,
  retrySupervisorEmployee,
  timeoutRecoveryEmployee,
} from "@aep/operator-agent/org/employees";
import type {
  AgentEmployeeDefinition,
  EmployeeRunRequest,
  OperatorAgentEnv,
  WorkerExecutionResponse,
} from "@aep/operator-agent/types";

export function selectWorkersForCronTick(
  scheduledTimeMs: number,
): AgentEmployeeDefinition[] {
  const minuteSlot = Math.floor(scheduledTimeMs / 60_000);
  const infraWorker =
    minuteSlot % 2 === 0 ? timeoutRecoveryEmployee : retrySupervisorEmployee;

  return [infraWorker, reliabilityEngineerEmployee];
}

export async function handleWorkerCron(
  env: OperatorAgentEnv,
  scheduledTimeMs = Date.now(),
): Promise<void> {
  const config = getConfig(env);
  const workers = selectWorkersForCronTick(scheduledTimeMs);

  console.log("[operator-agent] selected worker cron roster", {
    scheduledTimeMs,
    workerIds: workers.map((worker) => worker.identity.employeeId),
  });

  for (const employee of workers) {
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

    if (!("workerRole" in result)) {
      throw new Error(
        `Unexpected non-worker response for cron run of ${employee.identity.employeeId}`
      );
    }

    const workerResult: WorkerExecutionResponse = result;

    console.log("[operator-agent] worker cron run completed", {
      employeeId: workerResult.employee.employeeId,
      workerRole: workerResult.workerRole,
      dryRun: workerResult.dryRun,
      scanned: workerResult.scanned,
      summary: workerResult.summary,
    });
  }
}
