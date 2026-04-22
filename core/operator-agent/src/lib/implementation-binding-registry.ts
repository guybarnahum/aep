import { runPmAgent } from "@aep/operator-agent/agents/pm-agent";
import { runValidationAgent } from "@aep/operator-agent/agents/validation-agent";
import { runInfraOpsManager } from "@aep/operator-agent/agents/infra-ops-manager";
import { runRetrySupervisor } from "@aep/operator-agent/agents/retry-supervisor";
import { runTimeoutRecoveryOperator } from "@aep/operator-agent/agents/timeout-recovery";
import type {
  AgentExecutionResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
} from "@aep/operator-agent/types";

type ImplementationBindingExecutor = (
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
) => Promise<AgentExecutionResponse>;

function timeoutRecoveryWorkerExecutor(
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<AgentExecutionResponse> {
  switch (runContext.employee.identity.roleId) {
    case "timeout-recovery-operator":
      return runTimeoutRecoveryOperator(runContext, env);
    case "retry-supervisor":
      return runRetrySupervisor(runContext, env);
    default:
      throw new Error(
        `Implementation binding timeout-recovery-worker does not support roleId ${runContext.employee.identity.roleId}`,
      );
  }
}

function infraOpsManagerExecutor(
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<AgentExecutionResponse> {
  if (runContext.employee.identity.roleId !== "infra-ops-manager") {
    throw new Error(
      `Implementation binding infra-ops-manager does not support roleId ${runContext.employee.identity.roleId}`,
    );
  }

  return runInfraOpsManager(runContext, env);
}

function validationAgentExecutor(
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<AgentExecutionResponse> {
  if (runContext.employee.identity.roleId !== "reliability-engineer") {
    throw new Error(
      `Implementation binding validation-agent does not support roleId ${runContext.employee.identity.roleId}`,
    );
  }

  return runValidationAgent(runContext, env);
}

function pmAgentExecutor(
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<AgentExecutionResponse> {
  switch (runContext.employee.identity.roleId) {
    case "product-manager":
    case "product-manager-web":
    case "validation-pm":
      return runPmAgent(runContext, env);
    default:
      throw new Error(
        `Implementation binding pm-agent does not support roleId ${runContext.employee.identity.roleId}`,
      );
  }
}

const IMPLEMENTATION_BINDING_EXECUTORS: Record<string, ImplementationBindingExecutor> = {
  "timeout-recovery-worker": timeoutRecoveryWorkerExecutor,
  "infra-ops-manager": infraOpsManagerExecutor,
  "validation-agent": validationAgentExecutor,
  "pm-agent": pmAgentExecutor,
};

export function getImplementationBindingExecutor(
  implementationBinding: string,
): ImplementationBindingExecutor {
  const executor = IMPLEMENTATION_BINDING_EXECUTORS[implementationBinding];

  if (!executor) {
    throw new Error(
      `Unknown implementation_binding: ${implementationBinding}`,
    );
  }

  return executor;
}