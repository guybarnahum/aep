import type { EscalationPolicy } from "@aep/operator-agent/types";

export function cloneEscalation(policy: EscalationPolicy): EscalationPolicy {
  return {
    onBudgetExhausted: policy.onBudgetExhausted,
    onRepeatedVerificationFailure: policy.onRepeatedVerificationFailure,
    onProdTenantAction: policy.onProdTenantAction,
  };
}
