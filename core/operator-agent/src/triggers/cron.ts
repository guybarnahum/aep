import { getConfig } from "@aep/operator-agent/config";
import { makeCronFallbackContext } from "@aep/operator-agent/lib/execution-context";
import { executeEmployeeRun } from "@aep/operator-agent/lib/execute-employee-run";
import { COMPANY_INTERNAL_AEP } from "@aep/operator-agent/org/company";
import { resolveRuntimeEmployeeByRole } from "@aep/operator-agent/persistence/d1/runtime-employee-resolver-d1";
import type {
  AgentRoleId,
  EmployeeRunRequest,
  OperatorAgentEnv,
  WorkerExecutionResponse,
} from "@aep/operator-agent/types";

export function selectWorkersForCronTick(
  scheduledTimeMs: number,
): AgentRoleId[] {
  const minuteSlot = Math.floor(scheduledTimeMs / 60_000);
  const infraWorker: AgentRoleId =
    minuteSlot % 2 === 0 ? "timeout-recovery-operator" : "retry-supervisor";

  return [infraWorker, "reliability-engineer"];
}

export async function handleWorkerCron(
  env: OperatorAgentEnv,
  scheduledTimeMs = Date.now(),
): Promise<void> {
  const config = getConfig(env);
  const workerRoleIds = selectWorkersForCronTick(scheduledTimeMs);
  const workers = await Promise.all(
    workerRoleIds.map((roleId) =>
      resolveRuntimeEmployeeByRole({
        env,
        companyId: COMPANY_INTERNAL_AEP,
        roleId,
      }),
    ),
  );

  if (workers.some((employee) => !employee)) {
    throw new Error("Unable to resolve one or more active cron workers from D1");
  }

  const resolvedWorkers = workers.filter(
    (employee): employee is NonNullable<(typeof workers)[number]> => Boolean(employee),
  );

  console.log("[operator-agent] selected worker cron roster", {
    scheduledTimeMs,
    workerIds: resolvedWorkers.map((worker) => worker.identity.employeeId),
  });

  for (const employee of resolvedWorkers) {
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
