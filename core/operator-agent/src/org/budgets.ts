import type { AgentBudget } from "@aep/operator-agent/types";

export function cloneBudget(budget: AgentBudget): AgentBudget {
  return {
    maxActionsPerScan: budget.maxActionsPerScan,
    maxActionsPerHour: budget.maxActionsPerHour,
    maxActionsPerTenantPerHour: budget.maxActionsPerTenantPerHour,
    tokenBudgetDaily: budget.tokenBudgetDaily,
    runtimeBudgetMsPerScan: budget.runtimeBudgetMsPerScan,
    verificationReadsPerAction: budget.verificationReadsPerAction,
  };
}
