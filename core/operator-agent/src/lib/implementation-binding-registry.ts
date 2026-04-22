import type {
  AgentExecutionResponse,
  OperatorAgentEnv,
  ResolvedEmployeeRunContext,
} from "@aep/operator-agent/types";

type ImplementationBindingExecutor = (
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
) => Promise<AgentExecutionResponse>;

async function timeoutRecoveryWorkerExecutor(
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<AgentExecutionResponse> {
  switch (runContext.employee.identity.roleId) {
    case "timeout-recovery-operator": {
      const { runTimeoutRecoveryOperator } = await import(
        "../agents/timeout-recovery"
      );
      return runTimeoutRecoveryOperator(runContext, env);
    }
    case "retry-supervisor": {
      const { runRetrySupervisor } = await import("../agents/retry-supervisor");
      return runRetrySupervisor(runContext, env);
    }
    default:
      throw new Error(
        `Implementation binding timeout-recovery-worker does not support roleId ${runContext.employee.identity.roleId}`,
      );
  }
}

async function infraOpsManagerExecutor(
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<AgentExecutionResponse> {
  if (runContext.employee.identity.roleId !== "infra-ops-manager") {
    throw new Error(
      `Implementation binding infra-ops-manager does not support roleId ${runContext.employee.identity.roleId}`,
    );
  }

  const { runInfraOpsManager } = await import("../agents/infra-ops-manager");
  return runInfraOpsManager(runContext, env);
}

async function validationAgentExecutor(
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<AgentExecutionResponse> {
  if (runContext.employee.identity.roleId !== "reliability-engineer") {
    throw new Error(
      `Implementation binding validation-agent does not support roleId ${runContext.employee.identity.roleId}`,
    );
  }

  const { runValidationAgent } = await import("../agents/validation-agent");
  return runValidationAgent(runContext, env);
}

async function pmAgentExecutor(
  runContext: ResolvedEmployeeRunContext,
  env?: OperatorAgentEnv,
): Promise<AgentExecutionResponse> {
  switch (runContext.employee.identity.roleId) {
    case "product-manager":
    case "product-manager-web":
    case "validation-pm": {
      const { runPmAgent } = await import("../agents/pm-agent");
      return runPmAgent(runContext, env);
    }
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