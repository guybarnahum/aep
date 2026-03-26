import { runTimeoutRecoveryOperator } from "@aep/operator-agent/agents/timeout-recovery";
import type {
  EmployeeRunResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
} from "@aep/operator-agent/types";

export async function runRetrySupervisor(
  context: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv
): Promise<EmployeeRunResponse> {
  const result = await runTimeoutRecoveryOperator(context, env);

  return {
    ...result,
    workerRole: "retry-supervisor",
    message:
      "Retry Supervisor completed a bounded retry supervision run using the shared timeout-recovery execution path with its own authority and budget constraints.",
  };
}
